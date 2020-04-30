require('dotenv').config();
const JSBI = require('jsbi');
const { hexToString } = require('@polkadot/util');
const axios = require('axios');

const { mongoConnection } = require('./db/mongoConnection');
const { nodeConnection } = require('./nodeConnection');

// Models
const Validator = require('./db/models/Validator');
const State = require('./db/models/State');

(async () => {

  try {
    // Init DB connection
    mongoConnection.connect(`mongodb://localhost/${process.env.DB_NAME}`);

    // Get node ws connection
    const api = await nodeConnection.getInstance(process.env.WSNODE);

    // Check is State already initialized
    await State.find().countDocuments().then(async count => {
      if (count === 0) {
        let state = new State({ block: 0 });
        await state.save();
      }
    });

    // Subscribe to new blocks
    await api.rpc.chain.subscribeNewHeads(async (header) => {
      console.log(`Chain is at block: #${header.number}`);

      const [activeEra, validatorCount, sessionIndex, sessionsPerEra] = await Promise.all([
        api.query.staking.activeEra(),
        api.query.staking.validatorCount(),
        api.query.session.currentIndex(),
        api.consts.staking.sessionsPerEra
      ]);

      console.log(`Data loading complete for block #${header.number}`);
      
      let state = await State.findOne();
      state.block = header.number.toNumber();
      state.activeEra = activeEra.toJSON().index;
      state.activeEraStartAt = activeEra.toJSON().start;
      state.validatorSlots = validatorCount.toNumber();
      state.sessionIndex = sessionIndex.toNumber();
      state.sessionsPerEra = sessionsPerEra.toNumber();
      await state.save();

      console.log(`DB update complete for block #${header.number}`);
    });

    // Update validators/candidates
    let isValidatorsUpdateInProgress = false;
    for (; ;) {
      if (!isValidatorsUpdateInProgress) {
        isValidatorsUpdateInProgress = true;
        console.log('-- validators data update start');

        let sessionValidators = await api.query.session.validators().then(validators => validators);

        let imOnlineV = await api.derive.imOnline.receivedHeartbeats();

        let sessionIndexs = await api.derive.session.indexes();
        let currentSessionIndex = sessionIndexs.currentIndex;

        let overview = await api.derive.staking.overview();

        let valElected = overview.nextElected;


        await api.derive.staking.stashes().then(async candidates => {

          // Update app state
          let state = await State.findOne();
          state.activeValidators = sessionValidators.length;
          state.candidates = candidates.length - sessionValidators.length;
          await state.save();

          // Retrieve the balances for all validators
          let accountArr = await Promise.all(candidates.map(candidate => api.derive.staking.account(candidate)));

          // Retrieve identity info
          let identityArr = await Promise.all(candidates.map(candidate => api.query.identity.identityOf(candidate)));

          // Collect candidates stashes to clean up nodes db
          let candidatesStashes = [];

          for await (let [i, stashAddress] of candidates.entries()) {

            candidatesStashes.push(stashAddress.toString());

            // Init candidate/validator data
            let validator = {
              controlAddress: accountArr[i].controllerId.toString(),
              stashAddress: stashAddress.toString(),
              commission: accountArr[i].validatorPrefs.commission.toNumber() / 10000000,
              nominators: [],
              historicalData: {
                points: [],
                slashes: []
              }
            };

            let stakerPointsNot0 = [];

            if (sessionValidators.some(sv => sv.toString() === validator.stashAddress)) {
              validator.status = 1;

              let authoredBlocks = await api.query.imOnline.authoredBlocks(currentSessionIndex, validator.stashAddress.toString());
              validator.authoredBlocks = authoredBlocks.toNumber();

              let stakerPoints = await api.derive.staking.stakerPoints(validator.stashAddress.toString(), true);
              validator.points = stakerPoints[stakerPoints.length - 1].points.toNumber();
              stakerPointsNot0 = stakerPoints.filter(item => item.points.toNumber() > 0);
              //validator.averagePoints = stakerPoints.reduce((sum, current) => sum + current.points.toNumber(), 0) / stakerPoints.length;

              // if (validator.points < stakerPoints[stakerPoints.length - 2].points.toNumber()) {
              //   validator.pointsDown = true;
              // } else {
              //   validator.pointsDown = false;
              // }

              validator.heartbeats = imOnlineV[validator.stashAddress.toString()].hasMessage

            } else {
              validator.points = 0;
              validator.heartbeats = false;
              validator.authoredBlocks = 0;
              validator.status = 2;
            }

            let ownSlashes = await api.derive.staking.ownSlashes(validator.stashAddress.toString(), true);
            let valSlashes = ownSlashes.filter(item => item.total.toNumber() > 0);
            validator.downTimeSlashCounter84Eras = valSlashes.length;

            if (valElected.find(item => item.toString() === validator.stashAddress) != undefined) {
              validator.nextSessionElected = true;
              //debugger;
            } else {
              validator.nextSessionElected = false;
              //debugger;
            }

            let exposure = accountArr[i].exposure.toJSON();

            let stakeOwn = JSBI.BigInt(exposure.own);

            let stakeTotal = stakeOwn;
            exposure.others.forEach(nominator => {
              validator.nominators.push({
                address: nominator.who,
                stake: nominator.value
              });
              stakeTotal = JSBI.add(JSBI.BigInt(nominator.value), stakeTotal);
            });

            validator.stakeTotal = String(stakeTotal);
            validator.stakeOwn = String(stakeOwn);

            validator.info = new Map();
            if (!identityArr[i]['isEmpty']) {
              for await (let [identityKey, identityValue] of identityArr[i]._raw.info) {
                if (!identityValue['isEmpty']) {
                  validator.info.set(identityKey, identityValue._raw.toString());

                  // Save validator/candidate icon
                  if (identityKey === 'image') {
                    let url = hexToString(identityValue._raw.toString());

                    await axios
                      .get(url, {
                        responseType: 'arraybuffer'
                      })
                      .then(async response => {
                        validator.icon = Buffer.from(response.data, 'binary').toString('base64');
                      })
                      .catch(err => {
                        console.log(err.message);
                      });
                  }
                }
              }
            }

            await Validator.findOne({ stashAddress: validator.stashAddress }).then(async v => {
              if (v === null) {

                validator = addValidatorPoints(stakerPointsNot0, validator);

                validator = addValidatorSlashes(valSlashes, validator);

                // Add
                validator = new Validator(validator);

                try {
                  await validator.save();
                } catch (err) {
                  console.log(err);
                }
              } else {
                let maxSavedPointsEra = 0;

                if (v.historicalData != undefined){
                  if (v.historicalData.points != undefined) {
                    validator = addValidatorPoints(v.historicalData.points, validator);
                    if (v.historicalData.points.length > 0) {
                      maxSavedPointsEra = v.historicalData.points[v.historicalData.points.length - 1].era.toNumber();
                    }
                  }
                }

                let stakerPointsMoreMaxEra = stakerPointsNot0.filter(item => item.era.toNumber() > maxSavedPointsEra);
                validator = addValidatorPoints(stakerPointsMoreMaxEra, validator);


                let maxSavedSlashesEra = 0;
                if (v.historicalData != undefined){
                  if (v.historicalData.slashes != undefined) {
                    validator = addValidatorSlashes(v.historicalData.slashes, validator);
                    if (v.historicalData.slashes.length > 0) {
                      maxSavedSlashesEra = v.historicalData.slashes[v.historicalData.slashes.length - 1].era.toNumber();
                    }
                  }
                }

                let slashesMoreMaxEra = valSlashes.filter(item => item.era.toNumber() > maxSavedSlashesEra);
                validator = addValidatorSlashes(slashesMoreMaxEra, validator);

                // Update
                try {
                  await v.updateOne(validator);
                } catch (err) {
                  console.log(err);
                }
              }
            });

          }

          // Clean up db nodes list
          await Validator.find({}, async (err, validators) => {
            if (err) {
              console.log(err);
            }
            for await (let v of validators) {
              if (!candidatesStashes.includes(v.stashAddress)) {
                v.remove();
              }
            }
          });
          
          console.log('-- validators data update update end');
          isValidatorsUpdateInProgress = false;

        }).catch(error => {
          console.log(error);
          isValidatorsUpdateInProgress = false;
        });
      }
    }
  } catch (e) {
    console.log(e.message);
    process.exit();
  }

})();

function addValidatorPoints(pointsArr, validator) {
  pointsArr.forEach(point => {
    validator.historicalData.points.push({
      era: point.era.toNumber(),
      points: point.points.toNumber()
    });
  });
  return validator;
}

function addValidatorSlashes(slashesArr, validator) {
  slashesArr.forEach(slash => {
    validator.historicalData.slashes.push({
      era: slash.era.toNumber(),
      total: slash.total.toString()
    });
  });
  return validator;
}
