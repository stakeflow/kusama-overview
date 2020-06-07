require('dotenv').config();
const JSBI = require('jsbi');
const { hexToString } = require('@polkadot/util');
const axios = require('axios');
const delay = require('delay');

const { mongoConnection } = require('./db/mongoConnection');
const { nodeConnection } = require('./nodeConnection');

// Models
const Validator = require('./db/models/Validator');
const State = require('./db/models/State');

(async () => {

  try {
    // Init DB connection
    mongoConnection.connect(`mongodb://${process.env.DB_LOCATION}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

    // Get node ws connection
    const api = await nodeConnection.getInstance(process.env.WSNODE);

    // Check is State already initialized
    await State.find().countDocuments().then(async count => {
      if (count === 0) {
        let state = new State();
        await state.save();
      }
    });

    // Get app state and predefine sync status as finished
    let state = await State.findOne();
    state.isSyncing = false;

    // Data update flags
    let updateNetworkDataInProgress = false;
    let updateNodesDataInProgress = false;
    let updateNodesIdentitiesInProgress = false;

    // Check node status
    let { peersNumber, isSyncing } = await api.rpc.system.health().then(health => {
      return {
        peersNumber: health.peers.toNumber(),
        isSyncing: health.isSyncing.toString()
      }
    });

    // Wait synchronization process to finish
    while(peersNumber === 0 || isSyncing === "true") {
      console.log('Node is out of sync. Waiting...');

      if (state.isSyncing === false) {
        state.isSyncing = true;
        await state.save();
      }

      await delay(5000);
      await api.rpc.system.health().then(health => {
          peersNumber = health.peers.toNumber();
          isSyncing = health.isSyncing.toString();
      });
    }

    // Synchronization complete
    if (state.isSyncing === true) {
      state.isSyncing = false;
    }
    await state.save();

    // Subscribe to new blocks and update the DB with the new data
    await api.rpc.chain.subscribeNewHeads(async (header) => {
      console.log(`Chain is at block #${header.number}`);

      // Collect network statistics every block
      if (!updateNetworkDataInProgress) {
        updateNetworkDataInProgress = true;

        updateNetworkData(api, header).then(() => {
          console.log('\x1b[36m%s\x1b[0m', `Block #${header.number}: updateNetworkData ✅ `);
        }).catch(err => {
          console.log(err);
        }).finally(() => {
          updateNetworkDataInProgress = false;
        });
      }

      // Update nodes data every block
      if (!updateNodesDataInProgress) {
        updateNodesDataInProgress = true;

        updateNodesData(api).then(() => {
          console.log('\x1b[36m%s\x1b[0m', `Block #${header.number}: updateNodesData ✅ `);
        }).catch(err => {
          console.log(err);
        }).finally(() => {
          updateNodesDataInProgress = false;
        });
      }

      // Update nodes identities every 100 blocks
      if (!updateNodesIdentitiesInProgress && header.number % 100 === 0) {
        updateNodesIdentitiesInProgress = true;

        updateNodesIdentities(api).then(() => {
          console.log('\x1b[36m%s\x1b[0m', `Block #${header.number}: updateNodesIdentities ✅ `);
        }).catch(err => {
          console.log(err);
        }).finally(() => {
          updateNodesIdentitiesInProgress = false;
        });
      }

    });
  } catch (e) {
    console.log(e);
    process.exit();
  }

})();

function updateNetworkData(api, header) {
  return new Promise(async (resolve, reject) => {

    try {
      // Collect actual network data
      const [activeEra, validatorCount, sessionIndex, sessionsPerEra] = await Promise.all([
        api.query.staking.activeEra(),
        api.query.staking.validatorCount(),
        api.query.session.currentIndex(),
        api.consts.staking.sessionsPerEra
      ]);

      // Update DB with the actual network data
      let state = await State.findOne();
      state.block = header.number.toNumber();
      state.activeEra = activeEra.toJSON().index;
      state.activeEraStartAt = activeEra.toJSON().start;
      state.validatorSlots = validatorCount.toNumber();
      state.sessionIndex = sessionIndex.toNumber();
      state.sessionsPerEra = sessionsPerEra.toNumber();
      await state.save();

      resolve();
    } catch (err) {
      reject(err);
    }

  });
}

function updateNodesData(api) {
  return new Promise(async (resolve, reject) => {

    try {

      // Collect required data
      let [sessionValidators, heartbeats, sessionIndexes, stackingOverview, networkNodes] = await Promise.all([
        api.query.session.validators(),
        api.derive.imOnline.receivedHeartbeats(),
        api.derive.session.indexes(),
        api.derive.staking.overview(),
        api.derive.staking.stashes()
      ]);
      let currentSessionIndex = sessionIndexes.currentIndex;
      let nextElected = stackingOverview.nextElected;

      // Collect the accounts information for all network nodes
      let accountsInfo = await Promise.all(networkNodes.map(candidate => api.derive.staking.account(candidate)));

      // Update app state (validators and candidates number)
      let state = await State.findOne();
      state.activeValidators = sessionValidators.length;
      state.candidates = networkNodes.length - sessionValidators.length;
      await state.save();

      // Update data for every network node
      for await (let [i, stashAddress] of networkNodes.entries()) {

        // Find the node in DB or create the new one
        await Validator.findOne({ stashAddress: stashAddress.toString() }).then(async node => {

          if (node === null) {
            node = new Validator({
              controlAddress: accountsInfo[i].controllerId.toString(),
              stashAddress: stashAddress.toString(),
              commission: accountsInfo[i].validatorPrefs.commission.toNumber() / 10000000,
              nominators: [],
              historicalData: {
                points: [],
                slashes: []
              }
            });
          }

          // Get Era Points and Slashes historical data for node
          let eraPointsHistory = await api.derive.staking.stakerPoints(node.stashAddress, true);
          let slashesHistory = await api.derive.staking.ownSlashes(node.stashAddress, true);

          // Get account exposure for node
          let exposure = accountsInfo[i].exposure.toJSON();

          // Check node status (validator or candidate) and update it with the new data
          if (sessionValidators.some(sv => sv.toString() === node.stashAddress)) {
            node.status = 1;
            node.authoredBlocks = await api.query.imOnline.authoredBlocks(currentSessionIndex, node.stashAddress).then(authoredBlocks => authoredBlocks.toNumber());
            node.points = eraPointsHistory[eraPointsHistory.length - 1].points.toNumber();
            node.heartbeats = heartbeats[node.stashAddress].hasMessage;
          } else {
            node.status = 2;
            node.authoredBlocks = 0;
            node.points = 0;
            node.heartbeats = false;
          }

          // Check the number of slashes for node
          node.downTimeSlashCounter84Eras = slashesHistory.filter(item => item.total.toNumber() > 0).length;

          // Check is node elected for next session or not
          node.nextSessionElected = nextElected.find(item => item.toString() === node.stashAddress) !== undefined;

          // Reset node nominators list and total stake value
          node.nominators = [];
          node.stakeTotal = "0";

          // Update node's own stake
          node.stakeOwn = exposure.own;

          // Add node's own stash as a nominator and add it's stake to totalStake
          node.nominators.push({
            address: node.stashAddress,
            stake: exposure.own
          });
          node.stakeTotal = String(JSBI.add(JSBI.BigInt(exposure.own), JSBI.BigInt(node.stakeTotal)));

          // Add node nominators and update total stake
          let nominatorsTotalStake = JSBI.BigInt("0");
          exposure.others.forEach(nominator => {
            node.nominators.push({
              address: nominator.who,
              stake: nominator.value
            });
            nominatorsTotalStake = JSBI.add(JSBI.BigInt(nominator.value), nominatorsTotalStake);
          });
          node.stakeTotal = String(JSBI.add(JSBI.BigInt(node.stakeTotal), nominatorsTotalStake));

          // Update Era Points historical data
          eraPointsHistory.forEach(pointsPerEra => {
            if (!node.historicalData.points.some(ep => ep.era === pointsPerEra.era.toNumber())) {
              node.historicalData.points.push({
                era: pointsPerEra.era.toNumber(),
                points: pointsPerEra.points.toNumber()
              });
            }
          });

          // Update Slashes historical data
          slashesHistory.forEach(slashesPerEra => {
            if (!node.historicalData.slashes.some(es => es.era === slashesPerEra.era.toNumber())) {
              node.historicalData.slashes.push({
                era: slashesPerEra.era.toNumber(),
                total: slashesPerEra.total.toNumber()
              });
            }
          });

          // Save node in DB
          try {
            await node.save();
          } catch (err) {
            console.log(err);
          }
        });
      }

      // Clean up DB nodes list
      let networkNodesStashAddresses = networkNodes.map(node => node.toString());
      await Validator.find({}, async (err, validators) => {
        if (err) {
          console.log(err);
        }
        for await (let v of validators) {
          if (!networkNodesStashAddresses.includes(v.stashAddress)) {
            v.remove();
          }
        }
      });

      resolve();
    } catch (err) {
      reject(err);
    }

  });
}

function updateNodesIdentities(api) {
  return new Promise(async (resolve, reject) => {

    try {

      // Get all nodes stored in DB
      await Validator.find({}, async (err, nodes) => {
        if (err) {
          console.log(err);
        }

        // Collect the identities for the currently saved nodes
        let identities = await Promise.all(nodes.map(node => api.query.identity.identityOf(node.stashAddress)));

        // Update identity for nodes
        for await (let [i, node] of nodes.entries()) {
          node.info = new Map();
          if (!identities[i]['isEmpty']) {
            for await (let [identityKey, identityValue] of identities[i]._raw.info) {
              if (!identityValue['isEmpty']) {
                node.info.set(identityKey, identityValue._raw.toString());

                // Save node icon
                if (identityKey === 'image') {
                  let url = hexToString(identityValue._raw.toString());

                  await axios.get(url, {
                      responseType: 'arraybuffer'
                    })
                    .then(async response => {
                      node.icon = Buffer.from(response.data, 'binary').toString('base64');
                    })
                    .catch(err => {
                      console.log(err.message);
                    });
                }
              }
            }
          }
          node.save();
        }

        resolve();
      });
    } catch (err) {
      reject(err);
    }

  });
}
