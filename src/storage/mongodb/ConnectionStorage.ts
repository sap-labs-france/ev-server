import Connection from '../../types/Connection';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'ConnectionStorage';

export default class ConnectionStorage {

  public static async saveConnection(tenant: Tenant, connectionToSave: Connection): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Create
    const connectionMDB: any = {
      _id: !connectionToSave.id ? new ObjectId() : DatabaseUtils.convertToObjectID(connectionToSave.id),
      connectorId: connectionToSave.connectorId,
      userId: DatabaseUtils.convertToObjectID(connectionToSave.userId),
      createdAt: Utils.convertToDate(connectionToSave.createdAt),
      updatedAt: Utils.convertToDate(connectionToSave.updatedAt),
      validUntil: Utils.convertToDate(connectionToSave.validUntil),
      data: connectionToSave.data
    };
    // Update
    const result = await global.database.getCollection<any>(tenant.id, 'connections').findOneAndUpdate(
      { _id: connectionMDB._id },
      { $set: connectionMDB },
      { upsert: true, returnDocument: 'after' });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveConnection', startTime, connectionMDB);
    return result.value._id.toString();
  }

  public static async getConnectionByConnectorIdAndUserId(tenant: Tenant, connectorId: string, userId: string, projectFields?: string[]): Promise<Connection> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const aggregation = [];
    aggregation.push({
      $match: { connectorId: connectorId, userId: DatabaseUtils.convertToObjectID(userId) }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userId');
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Exec
    const connections = await global.database.getCollection<any>(tenant.id, 'connections')
      .aggregate<any>(aggregation)
      .toArray() as Connection[];
    let connection: Connection;
    if (!Utils.isEmptyArray(connections)) {
      connection = connections[0];
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getConnectionByConnectorIdAndUserId', startTime, aggregation, connections);
    return connection;
  }

  public static async getConnectionsByUserId(tenant: Tenant, userID: string, projectFields?: string[]): Promise<DataResult<Connection>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const aggregation = [];
    aggregation.push({
      $match: { userId: DatabaseUtils.convertToObjectID(userID) }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userId');
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Get connections
    const connectionsMDB = await global.database.getCollection<any>(tenant.id, 'connections')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Connection[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getConnectionByUserId', startTime, aggregation, connectionsMDB);
    return {
      count: connectionsMDB.length,
      result: connectionsMDB
    };
  }

  public static async getConnection(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID, projectFields?: string[]): Promise<Connection> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { _id: DatabaseUtils.convertToObjectID(id) }
    });
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userId');
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Exec
    const connections = await global.database.getCollection<any>(tenant.id, 'connections')
      .aggregate<any>(aggregation)
      .toArray() as Connection[];
    let connection: Connection;
    if (!Utils.isEmptyArray(connections)) {
      connection = connections[0];
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getConnection', startTime, aggregation, connections);
    return connection;
  }

  public static async deleteConnectionById(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'connections')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteConnectionById', startTime, { id });
  }

  public static async deleteConnectionByUserId(tenant: Tenant, userID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'connections')
      .deleteMany({ 'userId': DatabaseUtils.convertToObjectID(userID) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteConnectionByUserId', startTime, { userID });
  }
}
