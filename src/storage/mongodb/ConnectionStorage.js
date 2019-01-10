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
    // Modify
    const result = await global.database.getCollection(tenantID, 'connections').findOneAndUpdate(
      connectionFilter,
      {$set: connection},
      {upsert: true, new: true, returnOriginal: false});
    // Debug
    Logging.traceEnd('ConnectionStorage', 'saveConnection', uniqueTimerID);
    // Create
    return new Connection(tenantID, result.value);
  }

}

module.exports = ConnectionStorage;
