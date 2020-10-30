import Connection from '../../types/Connection';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'ConnectionStorage';

export default class ConnectionStorage {

  static async saveConnection(tenantID: string, connectionToSave: Connection): Promise<string> {
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveConnection');
    await Utils.checkTenant(tenantID);
    // Create
    const connectionMDB: any = {
      _id: !connectionToSave.id ? new ObjectID() : Utils.convertToObjectID(connectionToSave.id),
      connectorId: connectionToSave.connectorId,
      userId: Utils.convertToObjectID(connectionToSave.userId),
      createdAt: Utils.convertToDate(connectionToSave.createdAt),
      updatedAt: Utils.convertToDate(connectionToSave.updatedAt),
      validUntil: Utils.convertToDate(connectionToSave.validUntil),
      data: connectionToSave.data
    };
    // Update
    const result = await global.database.getCollection<any>(tenantID, 'connections').findOneAndUpdate(
      { _id: connectionMDB._id },
      { $set: connectionMDB },
      { upsert: true, returnOriginal: false });
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveConnection', uniqueTimerID);
    return result.value._id.toHexString();
  }

  static async getConnectionByConnectorIdAndUserId(tenantID: string, connectorId: string, userId: string): Promise<Connection> {
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getConnectionByConnectorIdAndUserId');
    await Utils.checkTenant(tenantID);
    const aggregation = [];
    aggregation.push({
      $match: { connectorId: connectorId, userId: Utils.convertToObjectID(userId) }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userId');
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Exec
    const results = await global.database.getCollection<any>(tenantID, 'connections')
      .aggregate(aggregation)
      .toArray();
    let connection: Connection;
    if (results && results.length > 0) {
      connection = results[0];
    }
    Logging.traceEnd(tenantID, MODULE_NAME, 'getConnectionByConnectorIdAndUserId', uniqueTimerID, { connectorId, userId });
    return connection;
  }

  static async getConnectionsByUserId(tenantID: string, userID: string): Promise<DataResult<Connection>> {
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getConnectionsByUserId');
    await Utils.checkTenant(tenantID);
    const aggregation = [];
    aggregation.push({
      $match: { userId: Utils.convertToObjectID(userID) }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userId');
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Count Records
    const connectionsCountMDB = await global.database.getCollection<any>(tenantID, 'connections')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    const connectionsMDB = await global.database.getCollection<Connection>(tenantID, 'connections')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    Logging.traceEnd(tenantID, MODULE_NAME, 'getConnectionByUserId', uniqueTimerID);
    return {
      count: (connectionsCountMDB.length > 0 ? connectionsCountMDB[0].count : 0),
      result: connectionsMDB
    };
  }

  static async getConnection(tenantID: string, id: string = Constants.UNKNOWN_OBJECT_ID): Promise<Connection> {
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getConnection');
    await Utils.checkTenant(tenantID);
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { _id: Utils.convertToObjectID(id) }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userId');
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Exec
    const results = await global.database.getCollection<Connection>(tenantID, 'connections')
      .aggregate(aggregation)
      .toArray();
    let connection: Connection;
    if (results && results.length > 0) {
      connection = results[0];
    }
    Logging.traceEnd(tenantID, MODULE_NAME, 'getConnection', uniqueTimerID);
    return connection;
  }

  static async deleteConnectionById(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteConnection');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection<Connection>(tenantID, 'connections')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteConnection', uniqueTimerID, { id });
  }

  static async deleteConnectionByUserId(tenantID: string, userId: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteConnectionByUser');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection<any>(tenantID, 'connections')
      .deleteMany({ 'userId': Utils.convertToObjectID(userId) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteConnectionByUser', uniqueTimerID, { userId });
  }
}
