import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import VehicleManufacturer from '../../types/VehicleManufacturer';
import VehicleStorage from './VehicleStorage';

export default class VehicleManufacturerStorage {

  public static async getVehicleManufacturerLogo(tenantID: string, id: string): Promise<{id: string; logo: string}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'getVehicleManufacturerLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const vehicleManufacturerLogosMDB = await global.database.getCollection<any>(tenantID, 'vehiclemanufacturerlogos')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let vehicleManufacturerLogo = null;
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

  public static async getVehicleManufacturerLogos(tenantID: string, IDs?: string[]): Promise<{id: string; logo: string}[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'getVehicleManufacturerLogos');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const vehicleManufacturerLogosMDB = await global.database.getCollection<any>(tenantID, 'vehiclemanufacturerlogos')
      .find()
      .toArray();
    const vehicleManufacturerLogos = [];
    // Check
    if (vehicleManufacturerLogosMDB && vehicleManufacturerLogosMDB.length > 0) {
      // Add
      for (const vehicleManufacturerLogoMDB of vehicleManufacturerLogosMDB) {
        vehicleManufacturerLogos.push({
          id: vehicleManufacturerLogoMDB._id.toHexString(),
          logo: vehicleManufacturerLogoMDB.logo
        });
      }
    }
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'getVehicleManufacturerLogos', uniqueTimerID);
    return vehicleManufacturerLogos;
  }

  public static async saveVehicleManufacturerLogo(tenantID: string, vehicleManufacturerLogoToSave: {id: string; logo: string}) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'saveVehicleManufacturerLogo');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID/Name is provided
    if (!vehicleManufacturerLogoToSave.id) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        'Vehicle Manufacturer Logo has no ID',
        'VehicleManufacturerStorage', 'saveVehicleManufacturerLogo');
    }
    // Modify
    await global.database.getCollection<any>(tenantID, 'vehiclemanufacturerlogos').findOneAndUpdate(
      { '_id': Utils.convertToObjectID(vehicleManufacturerLogoToSave.id) },
      { $set: { logo: vehicleManufacturerLogoToSave.logo } },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'saveVehicleManufacturerLogo', uniqueTimerID);
  }

  public static async getVehicleManufacturer(tenantID: string, id: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'getVehicleManufacturer');
    // Get
    const result = await VehicleManufacturerStorage.getVehicleManufacturers(tenantID, { manufacturerIDs: [id], withVehicles: true }, { limit: 1, skip: 0 });
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
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        'Vehicle Manufacturer has no ID and no Name',
        'VehicleManufacturerStorage', 'saveVehicleManufacturer');
    }
    const vehicleManufacturerFilter: any = {};
    // Build Request
    if (vehicleManufacturerToSave.id) {
      vehicleManufacturerFilter._id = Utils.convertToObjectID(vehicleManufacturerToSave.id);
    } else {
      vehicleManufacturerFilter._id = new ObjectID();
    }
    // Build
    const vmMDB = { ...vehicleManufacturerToSave };
    delete vmMDB.vehicles;
    delete vmMDB.logo;
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(vmMDB, vehicleManufacturerToSave);
    // Modify
    const result = await global.database.getCollection<any>(tenantID, 'vehiclemanufacturers').findOneAndUpdate(
      vehicleManufacturerFilter,
      { $set: vmMDB },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'saveVehicleManufacturer', uniqueTimerID, { vehicleManufacturerToSave });
    // Create
    return vehicleManufacturerFilter._id.toHexString();
  }

  // Delegate
  public static async getVehicleManufacturers(tenantID: string,
    params: {search?: string; withVehicles?: boolean; vehicleType?: string; manufacturerIDs?: string[]}, dbParams: DbParams) {
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
    if (params.search) {
      // Build filter
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } }
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
    if (params.manufacturerIDs) {
      aggregation.push({
        $match: {
          _id: { $in: params.manufacturerIDs.map((id) => {
            return Utils.convertToObjectID(id);
          }) }
        }
      });
    }
    // With Vehicles
    if (params.withVehicles || params.vehicleType) {
      //  Vehicles
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, 'vehicles'),
          localField: '_id',
          foreignField: 'vehicleManufacturerID',
          as: 'vehicles'
        }
      });
      DatabaseUtils.renameDatabaseID(aggregation, 'vehicles');
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
      // Sort
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      // Default
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
    // Read DB
    const vehiclemanufacturersMDB = await global.database.getCollection<VehicleManufacturer>(tenantID, 'vehiclemanufacturers')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'getVehicleManufacturers', uniqueTimerID, { params, dbParams });
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
    const vehicles = await VehicleStorage.getVehicles(tenantID, { 'vehicleManufacturerID': id }, { limit: Constants.DB_RECORD_COUNT_CEIL, skip: 0 });
    // Delete
    for (const vehicle of vehicles.result) {
      // Delete Vehicle
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
