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
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveConnection', uniqueTimerID, connectionMDB);
    return result.value._id.toHexString();
  }

  static async getConnectionByConnectorIdAndUserId(tenantID: string, connectorId: string, userId: string, projectFields?: string[]): Promise<Connection> {
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Exec
    const connections = await global.database.getCollection<any>(tenantID, 'connections')
      .aggregate(aggregation)
      .toArray();
    let connection: Connection;
    if (connections && connections.length > 0) {
      connection = connections[0];
    }
    Logging.traceEnd(tenantID, MODULE_NAME, 'getConnectionByConnectorIdAndUserId', uniqueTimerID, connections);
    return connection;
  }

  static async getConnectionsByUserId(tenantID: string, userID: string, projectFields?: string[]): Promise<DataResult<Connection>> {
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Get connections
    const connectionsMDB = await global.database.getCollection<Connection>(tenantID, 'connections')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    Logging.traceEnd(tenantID, MODULE_NAME, 'getConnectionByUserId', uniqueTimerID, connectionsMDB);
    return {
      count: connectionsMDB.length,
      result: connectionsMDB
    };
  }

  static async getConnection(tenantID: string, id: string = Constants.UNKNOWN_OBJECT_ID, projectFields?: string[]): Promise<Connection> {
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Exec
    const connections = await global.database.getCollection<Connection>(tenantID, 'connections')
      .aggregate(aggregation)
      .toArray();
    let connection: Connection;
    if (connections && connections.length > 0) {
      connection = connections[0];
    }
    Logging.traceEnd(tenantID, MODULE_NAME, 'getConnection', uniqueTimerID, connections);
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

  static async deleteConnectionByUserId(tenantID: string, userID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteConnectionByUser');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection<any>(tenantID, 'connections')
      .deleteMany({ 'userId': Utils.convertToObjectID(userID) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteConnectionByUser', uniqueTimerID, { userID });
  }
}
