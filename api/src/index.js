require('dotenv').config();
const {mongoConnection} = require('./db/mongoConnection');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jsonRouter = require('express-json-rpc-router');
const JSBI = require('jsbi');

// Models
const State = require('./db/models/State');
const Validator = require('./db/models/Validator');

// Init DB connection
mongoConnection.connect(`mongodb://localhost/${process.env.DB_NAME}`);

// API methods
const controller = {

  async getAppState() {
    return State.findOne((err, state) => {
      if (err) {
        console.log(err);
      }
      return state;
    });
  },

  async getNodes() {
    return Validator.find({}, { historicalData: 0, events: 0 }, (err, validators) => {
      if (err) {
        console.log(err);
      }
      return validators;
    });
  },

  async getNode(params) {
    return Validator.findOne({ stashAddress: params.stashAddress }, { events: 0 }, (err, validator) => {
      if (err) {
        console.log(err);
      }
      return validator;
    });
  },

  async getUserStakes({addresses}) {
    let userStakes = {};

    let validators = await Validator.find({"nominators.address": addresses}, {
      stashAddress: 1,
      nominators: 1
    }, async (err, validators) => {
      if (err) {
        console.log(err);
      } else {
        return validators;
      }
    });

    addresses.forEach(address => {
      validators.forEach(v => {
        let nominator = v.nominators.find(n => n.address === address);
        if (nominator !== undefined) {
          userStakes[v.stashAddress] = (userStakes[v.stashAddress] !== undefined) ? JSBI.BigInt(userStakes[v.stashAddress]) : JSBI.BigInt('0');
          userStakes[v.stashAddress] = String(JSBI.add(userStakes[v.stashAddress], JSBI.BigInt(nominator.stake)));
        }
      });
    });

    return {
      userStakes: userStakes
    }
  }

};

// Init and start express app
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(jsonRouter({methods: controller}));

app.listen(process.env.APP_API_PORT, () => {
  console.log(`API listening on port ${process.env.APP_API_PORT}`);
});
