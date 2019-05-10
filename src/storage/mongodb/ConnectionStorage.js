const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');

class ConnectionStorage {

  static async saveConnection(tenantID, connectionToSave) {
    const uniqueTimerID = Logging.traceStart('ConnectionStorage', 'saveConnection');
    await Utils.checkTenant(tenantID);
    const Connection = require('../../integration/Connection');
    const connection = {};
    Database.updateConnection(connectionToSave, connection, false);
    const connectionFilter = {
      connectorId: connectionToSave.connectorId,
      userId: Utils.convertUserToObjectID(connectionToSave.userId)
    };
    const result = await global.database.getCollection(tenantID, 'connections').findOneAndUpdate(
      connectionFilter,
      { $set: connection },
      { upsert: true, new: true, returnOriginal: false });
    Logging.traceEnd('ConnectionStorage', 'saveConnection', uniqueTimerID);
    return new Connection(tenantID, result.value);
  }

  static async getConnectionByUserId(tenantID, connectorId, userId) {
    const uniqueTimerID = Logging.traceStart('ConnectionStorage', 'getConnectionByUserId');
    await Utils.checkTenant(tenantID);
    const Connection = require('../../integration/Connection');
    const aggregation = [];
    aggregation.push({
      $match: { connectorId: connectorId, userId: Utils.convertToObjectID(userId) }
    });

    const results = await global.database.getCollection(tenantID, 'connections')
      .aggregate(aggregation)
      .toArray();

    let connection = undefined;
    if (results && results.length > 0) {
      connection = new Connection(tenantID, results[0]);
    }
    Logging.traceEnd('ConnectionStorage', 'getConnectionByUserId', uniqueTimerID);
    return connection;
  }

  static async getConnectionsByUserId(tenantID, userId) {
    const uniqueTimerID = Logging.traceStart('ConnectionStorage', 'getConnectionsByUserId');
    await Utils.checkTenant(tenantID);
    const Connection = require('../../integration/Connection');
    const aggregation = [];
    aggregation.push({
      $match: { userId: Utils.convertToObjectID(userId) }
    });
    // Count Records
    const connectionsCountMDB = await global.database.getCollection(tenantID, 'connections')
      .aggregate([...aggregation, { $count: "count" }])
      .toArray();
    const connectionsMDB = await global.database.getCollection(tenantID, 'connections')
      .aggregate(aggregation, {
        collation: {
          locale: Constants.DEFAULT_LOCALE,
          strength: 2
        }
      })
      .toArray();

    const connections = [];
    for (const connectionMDB of connectionsMDB) {
      connections.push(new Connection(tenantID, connectionMDB));
    }
    Logging.traceEnd('ConnectionStorage', 'getConnectionByUserId', uniqueTimerID);
    return {
      count: (connectionsCountMDB.length > 0 ? connectionsCountMDB[0].count : 0),
      result: connections
    };
  }


  static async getConnection(tenantID, id) {
    const uniqueTimerID = Logging.traceStart('ConnectionStorage', 'getConnection');
    await Utils.checkTenant(tenantID);
    const Connection = require('../../integration/Connection');
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { _id: Utils.convertToObjectID(id) }
    });

    const results = await global.database.getCollection(tenantID, 'connections')
      .aggregate(aggregation)
      .toArray();

    let connection = null;
    if (results && results.length > 0) {
      connection = new Connection(tenantID, results[0]);
    }
    Logging.traceEnd('ConnectionStorage', 'getConnection', uniqueTimerID);
    return connection;
  }

  static async deleteConnectionById(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConnectionStorage', 'deleteConnection');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection(tenantID, 'connections')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('ConnectionStorage', 'deleteConnection', uniqueTimerID, { id });
  }

}

module.exports = ConnectionStorage;
