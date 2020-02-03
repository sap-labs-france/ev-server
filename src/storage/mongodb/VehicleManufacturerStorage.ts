import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import VehicleManufacturer from '../../types/VehicleManufacturer';
import VehicleStorage from './VehicleStorage';
import { DataResult, LogoResult } from '../../types/DataResult';

export default class VehicleManufacturerStorage {

  public static async getVehicleManufacturerLogo(tenantID: string, id: string): Promise<LogoResult> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'getVehicleManufacturerLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const vehicleManufacturerLogosMDB = await global.database.getCollection<any>(tenantID, 'vehiclemanufacturerlogos')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let vehicleManufacturerLogo: LogoResult = null;
    // Set
    if (vehicleManufacturerLogosMDB && vehicleManufacturerLogosMDB.length > 0) {
      vehicleManufacturerLogo = {
        id: vehicleManufacturerLogosMDB[0]._id.toHexString(),
        logo: vehicleManufacturerLogosMDB[0].logo
      };
    }
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'getVehicleManufacturerLogo', uniqueTimerID, { id });
    return vehicleManufacturerLogo;
  }

  public static async saveVehicleManufacturerLogo(tenantID: string, vehicleManufacturerID: string, vehicleManufacturerLogoToSave: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'saveVehicleManufacturerLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID/Name is provided
    if (!vehicleManufacturerID) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'VehicleManufacturerStorage',
        method: 'saveVehicleManufacturerLogo',
        message: 'Vehicle Manufacturer Logo has no ID'
      });
    }
    // Modify
    await global.database.getCollection<any>(tenantID, 'vehiclemanufacturerlogos').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(vehicleManufacturerID) },
      { $set: { logo: vehicleManufacturerLogoToSave } },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'saveVehicleManufacturerLogo', uniqueTimerID);
  }

  public static async getVehicleManufacturer(tenantID: string, id: string): Promise<VehicleManufacturer> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'getVehicleManufacturer');
    // Get
    const result = await VehicleManufacturerStorage.getVehicleManufacturers(
      tenantID, {
        vehicleManufacturerID: id,
        withVehicles: true
      }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'getVehicleManufacturer', uniqueTimerID, { id });
    return result.count > 0 ? result.result[0] : null;
  }

  public static async saveVehicleManufacturer(tenantID: string, vehicleManufacturerToSave: Partial<VehicleManufacturer>): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'saveVehicleManufacturer');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID/Model is provided
    if (!vehicleManufacturerToSave.id && !vehicleManufacturerToSave.name) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: 'VehicleManufacturerStorage',
        method: 'saveVehicleManufacturer',
        message: 'Vehicle Manufacturer has no ID and no Name'
      });
    }
    const vehicleManufacturerFilter: any = {};
    // Build Request
    if (vehicleManufacturerToSave.id) {
      vehicleManufacturerFilter._id = Utils.convertToObjectID(vehicleManufacturerToSave.id);
    } else {
      vehicleManufacturerFilter._id = new ObjectID();
    }
    // Build
    const vehicleManufacturerMDB = {
      _id: vehicleManufacturerFilter._id,
      name: vehicleManufacturerToSave.name
    };

    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(vehicleManufacturerMDB, vehicleManufacturerToSave);
    // Modify
    await global.database.getCollection<any>(tenantID, 'vehiclemanufacturers').findOneAndUpdate(
      vehicleManufacturerFilter,
      { $set: vehicleManufacturerMDB },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'saveVehicleManufacturer', uniqueTimerID, { vehicleManufacturerToSave });
    // Create
    return vehicleManufacturerFilter._id.toHexString();
  }

  // Delegate
  public static async getVehicleManufacturers(tenantID: string,
    params: { search?: string; withVehicles?: boolean; vehicleType?: string; vehicleManufacturerID?: string },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<VehicleManufacturer>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'getVehicleManufacturers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: any = {};
    // Source?
    if (params.vehicleManufacturerID) {
      filters._id = Utils.convertToObjectID(params.vehicleManufacturerID);
    } else if (params.search) {
      filters.$or = [
        { 'name': { $regex: Utils.escapeSpecialCharsInRegex(params.search), $options: 'i' } }
      ];
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // With Vehicles
    if (params.withVehicles || params.vehicleType) {
      DatabaseUtils.pushVehicleLookupInAggregation(
        {
          tenantID, aggregation, localField: '_id', foreignField: 'vehicleManufacturerID',
          asField: 'vehicles'
        });
    }
    // Type?
    if (params.vehicleType) {
      aggregation.push({
        $match: { 'vehicles.type': params.vehicleType }
      });
    }
    DatabaseUtils.renameDatabaseID(aggregation);
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const vehiclemanufacturersCountMDB = await global.database.getCollection<any>(tenantID, 'vehiclemanufacturers')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (vehiclemanufacturersCountMDB.length > 0 ? vehiclemanufacturersCountMDB[0].count : 0),
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
          name: 1
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
    const vehiclemanufacturersMDB = await global.database.getCollection<VehicleManufacturer>(tenantID, 'vehiclemanufacturers')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'getVehicleManufacturers', uniqueTimerID, {
      params,
      dbParams
    });
    // Ok
    return {
      count: (vehiclemanufacturersCountMDB.length > 0 ?
        (vehiclemanufacturersCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : vehiclemanufacturersCountMDB[0].count) : 0),
      result: vehiclemanufacturersMDB
    };
  }

  public static async deleteVehicleManufacturer(tenantID: string, id: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'deleteVehicleManufacturer');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Vehicles
    const vehicles = await VehicleStorage.getVehicles(tenantID,
      { 'vehicleManufacturerID': id }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const vehicle of vehicles.result) {
      await VehicleStorage.deleteVehicle(tenantID, vehicle.id);
    }
    // Delete the Vehicle Manufacturers
    await global.database.getCollection<any>(tenantID, 'vehiclemanufacturers')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete Vehicle Manufacturer Logo
    await global.database.getCollection<any>(tenantID, 'vehiclemanufacturerlogos')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'deleteVehicleManufacturer', uniqueTimerID, { id });
  }
}
