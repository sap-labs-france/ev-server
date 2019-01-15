const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const Logging = require('../../utils/Logging');

class ConnectionStorage {

  static async saveConnection(tenantID, connectionToSave) {
    const uniqueTimerID = Logging.traceStart('ConnectionStorage', 'saveConnection');
    await Utils.checkTenant(tenantID);
    const Connection = require('../../entity/integration/Connection');
    const connection = {};
    Database.updateConnection(connectionToSave, connection, false);
    const connectionFilter = {
      connectorId: connectionToSave.connectorId,
      userId: Utils.convertUserToObjectID(connectionToSave.userId)
    };
    const result = await global.database.getCollection(tenantID, 'connections').findOneAndUpdate(
      connectionFilter,
      {$set: connection},
      {upsert: true, new: true, returnOriginal: false});
    Logging.traceEnd('ConnectionStorage', 'saveConnection', uniqueTimerID);
    return new Connection(tenantID, result.value);
  }

  static async getConnectionByUserId(tenantID, connectorId, userId) {
    const uniqueTimerID = Logging.traceStart('ConnectionStorage', 'getConnectionByUserId');
    await Utils.checkTenant(tenantID);
    const Connection = require('../../entity/integration/Connection');
    const aggregation = [];
    aggregation.push({
      $match: {connectorId: connectorId, userId: Utils.convertToObjectID(userId)}
    });

    const results = await global.database.getCollection(tenantID, 'connections')
      .aggregate(aggregation)
      .toArray();

    let connection = null;
    if (results && results.length > 0) {
      connection = new Connection(tenantID, results[0]);
    }
    Logging.traceEnd('ConnectionStorage', 'getConnectionByUserId', uniqueTimerID);
    return connection;
  }

  static async getConnectionsByUserId(tenantID, userId) {
    const uniqueTimerID = Logging.traceStart('ConnectionStorage', 'getConnectionsByUserId');
    await Utils.checkTenant(tenantID);
    const Connection = require('../../entity/integration/Connection');
    const aggregation = [];
    aggregation.push({
      $match: {userId: Utils.convertToObjectID(userId)}
    });

    const results = await global.database.getCollection(tenantID, 'connections')
      .aggregate(aggregation)
      .toArray();

    let connection = null;
    if (results && results.length > 0) {
      connection = new Connection(tenantID, results[0]);
    }
    Logging.traceEnd('ConnectionStorage', 'getConnectionsByUserId', uniqueTimerID);
    return connection;
  }

}

module.exports = ConnectionStorage;
