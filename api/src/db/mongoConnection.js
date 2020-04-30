const mongoose = require('mongoose');

class MongoConnection {

  async connect(connectionString) {

    this.connectionString = connectionString;

    // Connect
    await mongoose.connect(connectionString, {useNewUrlParser: true, useUnifiedTopology: true});
    this.setupTriggers(mongoose.connection);

    // Close connection if SIGINT or SIGTERM appear
    process
      .on('SIGINT', this.gracefulExit(mongoose.connection))
      .on('SIGTERM', this.gracefulExit(mongoose.connection));

  }

  setupTriggers(connection) {

    connection
      .on('open', () => {
        console.log(`mongodb connection created to ${this.connectionString}`);
      })
      .on('disconnected', () => {
        console.log('mongodb disconnected');
      })
      .on('reconnect', () => {
        console.log('mongodb reconnected');
      })
      .on('error', (error) => {
        console.log(`Warning: ${error}`);
      });

  }

  gracefulExit(connection) {
    return () => connection.close(() => {
      console.log(`Mongoose connection \'${this.connectionString}\' is disconnected through app termination`);
      process.exit(0);
    });
  }

}

exports.mongoConnection = new MongoConnection();
