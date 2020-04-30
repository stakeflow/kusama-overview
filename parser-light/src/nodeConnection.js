const {ApiPromise, WsProvider} = require('@polkadot/api');

class NodeConnection {

  async getInstance(connectionString) {

    if (this.apiInstance === undefined) {
      await this.connect(connectionString);
    }

    return this.apiInstance;
  }

  async connect(connectionString) {

    // Connect
    const wsProvider = new WsProvider(connectionString);
    this.apiInstance = await ApiPromise.create({provider: wsProvider});

  }

}

exports.nodeConnection = new NodeConnection();
