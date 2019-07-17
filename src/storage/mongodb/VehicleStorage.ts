import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import Vehicle from '../../types/Vehicle';

export default class VehicleStorage {

  public static async getVehicleImage(tenantID: string, id: string): Promise<{id: string; images: string[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'getVehicleImage');
    const result = await VehicleStorage.getVehicleImages(tenantID, { IDs: [id] }, { limit: 1, skip: 0 });
    // Debug
    Logging.traceEnd('VehicleStorage', 'getVehicleImage', uniqueTimerID, { id });
    return result[0];
  }

  public static async getVehicleImages(tenantID: string, params: {IDs?: string[]}, dbParams: DbParams): Promise<{id: string; images: string[]}[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'getVehicleImages');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build aggregation
    const aggregation = [];
    if (params.IDs) {
      aggregation.push({
        $match: {
          _id: { $in: params.IDs.map((ID) => {
            return Utils.convertToObjectID(ID);
          }) }
        }
      });
    }
    DatabaseUtils.renameDatabaseID(aggregation);
    // DbParams
    if (dbParams.limit) {
      aggregation.push({ $limit: dbParams.limit });
    }
    if (dbParams.skip) {
      aggregation.push({ $skip: dbParams.skip });
    }
    // Read DB
    const vehicleImagesMDB = await global.database.getCollection<{id: string; images: string[]}>(tenantID, 'vehicleimages')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd('VehicleStorage', 'getVehicleImages', uniqueTimerID);
    return vehicleImagesMDB;
  }

  public static async getVehicle(tenantID: string, id: string): Promise<Vehicle> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'getVehicle');
    // Get vehicle
    const result = await VehicleStorage.getVehicles(tenantID, { vehicleIDs: [id] }, { limit: 1, skip: 0 });
    // Debug
    Logging.traceEnd('VehicleStorage', 'getVehicle', uniqueTimerID, { id });
    return result.count > 0 ? result.result[0] : null;
  }

  public static async saveVehicle(tenantID: string, vehicleToSave: Partial<Vehicle>): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'saveVehicle');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID/Model is provided
    if (!vehicleToSave.id && !vehicleToSave.model) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        'Vehicle has no ID and no Model',
        'VehicleStorage', 'saveVehicle');
    }
    const vehicleFilter: any = {};
    // Build Request
    if (vehicleToSave.id) {
      vehicleFilter._id = Utils.convertToObjectID(vehicleToSave.id);
    } else {
      vehicleFilter._id = new ObjectID();
    }
    // Copy
    const vehicleMDB = { ...vehicleToSave };
    delete vehicleMDB.images;
    delete vehicleMDB.logo;
    // Set Created By
    DatabaseUtils.addLastChangedCreatedProps(vehicleMDB, vehicleToSave);
    // Transfer
    const vehicle: any = {};
    // Modify
    const result = await global.database.getCollection<any>(tenantID, 'vehicles').findOneAndUpdate(
      vehicleFilter,
      { $set: vehicle },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('VehicleStorage', 'saveVehicle', uniqueTimerID, { vehicleToSave });
    // Create
    return vehicleFilter._id.toHexString();
  }

  public static async saveVehicleImages(tenantID: string, vehicleImagesToSave: {id: string; images: string[]}) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'saveVehicleImages');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!vehicleImagesToSave.id) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        'Vehicle Images has no ID',
        'VehicleStorage', 'saveVehicleImages');
    }
    // Modify
    await global.database.getCollection<any>(tenantID, 'vehicleimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(vehicleImagesToSave.id) },
      { $set: { images: vehicleImagesToSave.images } },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('VehicleStorage', 'saveVehicleImages', uniqueTimerID);
  }

  // Delegate
  public static async getVehicles(tenantID: string,
    params: {search?: string; vehicleManufacturerID?: string; vehicleType?: string; vehicleIDs?: string[]}, dbParams: DbParams): Promise<{count: number; result: Vehicle[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'getVehicles');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: any = {};
    // Source?
    if (params.search) {
      // Build filter
      filters.$or = [
        { 'model': { $regex: params.search, $options: 'i' } }
      ];
    }
    // Set Company?
    if (params.vehicleManufacturerID) {
      filters.vehicleManufacturerID = Utils.convertToObjectID(params.vehicleManufacturerID);
    }
    // Set Vehicle Type?
    if (params.vehicleType) {
      filters.type = params.vehicleType;
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    DatabaseUtils.renameDatabaseID(aggregation);
    if (params.vehicleIDs) {
      aggregation.push({
        $match: {
          id: { $in: params.vehicleIDs }
        }
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const vehiclesCountMDB = await global.database.getCollection<any>(tenantID, 'vehicles')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (vehiclesCountMDB.length > 0 ? vehiclesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Sort
    if (dbParams.sort) {
      // Sort
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: {
          manufacturer: 1, model: 1
        }
      });
    }
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Read DB
    const vehiclesMDB =
    await global.database.getCollection<Vehicle>(tenantID, 'vehicles')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('VehicleStorage', 'getVehicles', uniqueTimerID, { params, dbParams });
    // Ok
    return {
      count: (vehiclesCountMDB.length > 0 ?
        (vehiclesCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : vehiclesCountMDB[0].count) : 0),
      result: vehiclesMDB
    };
  }

  public static async deleteVehicle(tenantID: string, id: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'deleteVehicle');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Vehicle
    await global.database.getCollection<any>(tenantID, 'vehicles')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Images
    await global.database.getCollection<any>(tenantID, 'vehicleimages')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('VehicleStorage', 'deleteVehicle', uniqueTimerID, { id });
  }
}
