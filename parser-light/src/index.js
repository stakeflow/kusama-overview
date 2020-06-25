require('dotenv').config();
const JSBI = require('jsbi');
const { hexToString } = require('@polkadot/util');
const axios = require('axios');
const delay = require('delay');

const { mongoConnection } = require('./db/mongoConnection');
const { ApiPromise, WsProvider } = require('@polkadot/api');

// Models
const Validator = require('./db/models/Validator');
const State = require('./db/models/State');

// Init DB connection
mongoConnection.connect(`mongodb://${process.env.DB_LOCATION}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

// Init some common variables used across the different parts of the parser
let api;
let blockAuthors = [];

// Prepare updateInProgress flags
let updateNetworkDataInProgress = false;
let updateNodesDataInProgress = false;
let updateNodesIdentitiesInProgress = false;

// There is no need to perform some actions on every block in updateNodesData and only execute the code on session or era change
let lastSessionProcessed;
let lastEraProcessed;

(async () => {

  try {
    await init().then(() => {
      console.log('init ✅ ');
    }).catch(err => {
      console.log(err);
    });

    // Subscribe to new blocks and update the DB with the new data
    await api.derive.chain.subscribeNewHeads(async (header) => {

      // Collect actual network data
      let blockNumber = header.number.toNumber();
      let [eraIndex, sessionIndex] = await Promise.all([
        api.query.staking.activeEra(),
        api.query.session.currentIndex()
      ]);
      eraIndex = eraIndex.toJSON().index;
      sessionIndex = sessionIndex.toNumber();

      console.log(`Chain is at block ${blockNumber}, session ${sessionIndex}, era ${eraIndex}`);

      // Collect block authors to update data in updateNodesData()
      if (!blockAuthors.includes(header.author.toString())) {
        blockAuthors.push(header.author.toString());
      }

      // Collect network statistics every block
      if (!updateNetworkDataInProgress) {
        updateNetworkDataInProgress = true;

        updateNetworkData(blockNumber, eraIndex, sessionIndex).then(() => {
          console.log('\x1b[36m%s\x1b[0m', `Block #${blockNumber}: updateNetworkData ✅ `);
        }).catch(err => {
          console.log(err);
        }).finally(() => {
          updateNetworkDataInProgress = false;
        });
      }

      // Update nodes data every block
      if (!updateNodesDataInProgress) {
        updateNodesDataInProgress = true;

        updateNodesData(eraIndex, sessionIndex).then(() => {
          console.log('\x1b[36m%s\x1b[0m', `Block #${blockNumber}: updateNodesData ✅ `);
        }).catch(err => {
          console.log(err);
        }).finally(() => {
          updateNodesDataInProgress = false;
        });
      }

      // Update nodes identities every 100 blocks
      if (!updateNodesIdentitiesInProgress && header.number % 100 === 0) {
        updateNodesIdentitiesInProgress = true;

        updateNodesIdentities().then(() => {
          console.log('\x1b[36m%s\x1b[0m', `Block #${blockNumber}: updateNodesIdentities ✅ `);
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

function init() {
  return new Promise(async (resolve, reject) => {

    try {
      // Get polkadot node WS connection
      const wsProvider = new WsProvider(process.env.WSNODE);
      api = await ApiPromise.create({ provider: wsProvider });

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

      resolve();
    } catch (err) {
      reject(err);
    }

  });
}

function updateNetworkData(blockNumber, eraIndex, sessionIndex) {
  return new Promise(async (resolve, reject) => {

    try {
      // Update DB with the actual network data
      let state = await State.findOne();
      state.block = blockNumber;
      state.activeEra = eraIndex;
      state.sessionIndex = sessionIndex;
      await state.save();

      resolve();
    } catch (err) {
      reject(err);
    }

  });
}

function updateNodesData(eraIndex, sessionIndex) {
  return new Promise(async (resolve, reject) => {

    try {
      if (lastSessionProcessed === sessionIndex) {
        // Update data for block proposers only
        if (blockAuthors.length > 0) {

          let authorsList = blockAuthors.splice(0, blockAuthors.length);
          console.log(authorsList.length);

          // Collect required data
          let [heartbeats, currentNodePoints] = await Promise.all([
            api.derive.imOnline.receivedHeartbeats(),
            api.query.staking.erasRewardPoints(eraIndex)
          ]);

          for await (let blockAuthor of authorsList) {
            await Validator.findOne({ stashAddress: blockAuthor }).then(async node => {
              if (node !== null) {
                node.authoredBlocks = await api.query.imOnline.authoredBlocks(sessionIndex, node.stashAddress).then(authoredBlocks => authoredBlocks.toNumber());
                node.points = currentNodePoints.toJSON().individual[node.stashAddress];
                node.heartbeats = heartbeats[node.stashAddress].hasMessage;

                // Save node in DB
                try {
                  await node.save();
                } catch (err) {
                  console.log(err);
                }
              }
            });
          }
        }
      } else {
        // Do the full update only if session index was changed

        // Collect required data
        let [sessionValidators, heartbeats, nextElected, networkNodes, currentNodePoints] = await Promise.all([
          api.query.session.validators(),
          api.derive.imOnline.receivedHeartbeats(),
          api.derive.staking.nextElected(),
          api.derive.staking.stashes(),
          api.query.staking.erasRewardPoints(eraIndex)
        ]);

        // Update app state (validators, validator slots and candidates number) on session change
        let state = await State.findOne();
        state.activeValidators = sessionValidators.length;
        state.candidates = networkNodes.length - sessionValidators.length;
        state.validatorSlots = await api.query.staking.validatorCount().then(validatorCount => validatorCount.toNumber());
        await state.save();

        // Collect the accounts information for all network nodes
        let accountsInfo = await Promise.all(networkNodes.map(candidate => api.derive.staking.account(candidate)));

        // Store all the updated nodes in variable and update them all with the new data
        let nodesToUpdate = [];

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

            // Get account exposure for node
            let exposure = accountsInfo[i].exposure.toJSON();

            // Check node status (validator or candidate) and update it with the new data
            if (sessionValidators.some(sv => sv.toString() === node.stashAddress)) {
              node.status = 1;
              node.authoredBlocks = await api.query.imOnline.authoredBlocks(sessionIndex, node.stashAddress).then(authoredBlocks => authoredBlocks.toNumber());
              node.points = currentNodePoints.toJSON().individual[stashAddress.toString()];
              node.heartbeats = heartbeats[node.stashAddress].hasMessage;
            } else {
              node.status = 2;
              node.authoredBlocks = 0;
              node.points = 0;
              node.heartbeats = false;
            }

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

            if (lastEraProcessed !== eraIndex) {

              // Get Era Points and Slashes historical data for node
              let eraPointsHistory = await api.derive.staking.stakerPoints(node.stashAddress, true);
              let slashesHistory = await api.derive.staking.ownSlashes(node.stashAddress, true);

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
            }

            nodesToUpdate.push(node);
          });
        }

        // Save nodes with updated data
        await Promise.all(nodesToUpdate.map(node => node.save()));

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

        lastSessionProcessed = sessionIndex;
        lastEraProcessed = eraIndex;
      }

      resolve();
    } catch (err) {
      reject(err);
    }

  });
}

function updateNodesIdentities() {
  return new Promise(async (resolve, reject) => {

    try {

      // Get all nodes stored in DB
      await Validator.find({}, async (err, nodes) => {
        if (err) {
          console.log(err);
        }

        // Collect the identities for the currently saved nodes
        let identities = await Promise.all(nodes.map(node => api.query.identity.identityOf(node.stashAddress)));

        // Store all the updated identities in variable and update them all with the new data
        let nodesIdentitiesToUpdate = [];

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
          nodesIdentitiesToUpdate.push(node);
        }

        // Save new identities
        await Promise.all(nodesIdentitiesToUpdate.map(node => node.save()));

        resolve();
      });
    } catch (err) {
      reject(err);
    }

  });
}
