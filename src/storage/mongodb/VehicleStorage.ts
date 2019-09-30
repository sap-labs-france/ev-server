import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import Vehicle from '../../types/Vehicle';
import { DataResult, ImageResult } from '../../types/DataResult';

export default class VehicleStorage {

  public static async getVehicleImage(tenantID: string, id: string): Promise<ImageResult> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'getVehicleImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const vehicleImagesMDB = await global.database.getCollection<any>(tenantID, 'vehicleimages')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let vehicleImage: ImageResult = null;
    // Set
    if (vehicleImagesMDB && vehicleImagesMDB.length > 0) {
      vehicleImage = {
        id: vehicleImagesMDB[0]._id.toHexString(),
        image: vehicleImagesMDB[0].image
      };
    }
    // Debug
    Logging.traceEnd('VehicleStorage', 'getVehicleImage', uniqueTimerID, { id });
    return vehicleImage;
  }

  public static async getVehicle(tenantID: string, id: string): Promise<Vehicle> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'getVehicle');
    // Get vehicle
    const result = await VehicleStorage.getVehicles(tenantID, { vehicleIDs: [id] }, Constants.DB_PARAMS_SINGLE_RECORD);
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
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'VehicleStorage',
        method: 'saveVehicle',
        message: 'Vehicle has no ID and no Model'
      });
    }
    const vehicleFilter: any = {};
    // Build Request
    if (vehicleToSave.id) {
      vehicleFilter._id = Utils.convertToObjectID(vehicleToSave.id);
    } else {
      vehicleFilter._id = new ObjectID();
    }
    // Copy
    const vehicleMDB = {
      _id: vehicleFilter._id,
      vehicleManufacturerID: Utils.convertToObjectID(vehicleToSave.vehicleManufacturerID),
      type: vehicleToSave.type,
      model: vehicleToSave.model,
      batteryKW: Utils.convertToInt(vehicleToSave.batteryKW),
      autonomyKmWLTP: Utils.convertToInt(vehicleToSave.autonomyKmWLTP),
      autonomyKmReal: Utils.convertToInt(vehicleToSave.autonomyKmReal),
      horsePower: Utils.convertToInt(vehicleToSave.horsePower),
      torqueNm: Utils.convertToInt(vehicleToSave.torqueNm),
      performance0To100kmh: Utils.convertToInt(vehicleToSave.performance0To100kmh),
      weightKg: Utils.convertToInt(vehicleToSave.weightKg),
      lengthMeter: Utils.convertToInt(vehicleToSave.lengthMeter),
      widthMeter: Utils.convertToInt(vehicleToSave.widthMeter),
      heightMeter: Utils.convertToInt(vehicleToSave.heightMeter),
      releasedOn: Utils.convertToDate(vehicleToSave.releasedOn)
    };
    // Set Created By
    DatabaseUtils.addLastChangedCreatedProps(vehicleMDB, vehicleToSave);
    // Modify
    await global.database.getCollection<any>(tenantID, 'vehicles').findOneAndUpdate(
      vehicleFilter,
      { $set: vehicleMDB },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('VehicleStorage', 'saveVehicle', uniqueTimerID, { vehicleToSave });
    // Create
    return vehicleFilter._id.toHexString();
  }

  public static async saveVehicleImages(tenantID: string, vehicleID: string, vehicleImagesToSave: string[]) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'saveVehicleImages');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!vehicleID) {
      // ID must be provided!
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'VehicleStorage',
        method: 'saveVehicleImages',
        message: 'Vehicle Images has no ID'
      });
    }
    // Modify
    await global.database.getCollection<any>(tenantID, 'vehicleimages').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(vehicleID) },
      { $set: { images: vehicleImagesToSave } },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('VehicleStorage', 'saveVehicleImages', uniqueTimerID);
  }

  // Delegate
  public static async getVehicles(tenantID: string,
    params: {search?: string; vehicleManufacturerID?: string; vehicleType?: string; vehicleIDs?: string[]},
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<Vehicle>> {
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
    if (params.search) {
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
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
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
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const vehiclesMDB = await global.database.getCollection<Vehicle>(tenantID, 'vehicles')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('VehicleStorage', 'getVehicles', uniqueTimerID, { params, dbParams });
    // Ok
    return {
      count: (vehiclesCountMDB.length > 0 ?
        (vehiclesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : vehiclesCountMDB[0].count) : 0),
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
