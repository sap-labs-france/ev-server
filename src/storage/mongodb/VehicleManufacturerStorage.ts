import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import global from '../../types/GlobalType';
import Utils from '../../utils/Utils';
import VehicleManufacturer from '../../entity/VehicleManufacturer';
import Vehicle from '../../entity/Vehicle';
import VehicleStorage from './VehicleStorage';


export default class VehicleManufacturerStorage {

  static async getVehicleManufacturerLogo(tenantID, id) {
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
        id: vehicleManufacturerLogosMDB[0]._id,
        logo: vehicleManufacturerLogosMDB[0].logo
      };
    }
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'getVehicleManufacturerLogo', uniqueTimerID, { id });
    return vehicleManufacturerLogo;
  }

  static async getVehicleManufacturerLogos(tenantID) {
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
          id: vehicleManufacturerLogoMDB._id,
          logo: vehicleManufacturerLogoMDB.logo
        });
      }
    }
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'getVehicleManufacturerLogos', uniqueTimerID);
    return vehicleManufacturerLogos;
  }

  static async saveVehicleManufacturerLogo(tenantID, vehicleManufacturerLogoToSave) {
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

  static async getVehicleManufacturer(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'getVehicleManufacturer');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { _id: Utils.convertToObjectID(id) }
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Read DB
    const vehicleManufacturersMDB = await global.database.getCollection<any>(tenantID, 'vehiclemanufacturers')
      .aggregate(aggregation, { allowDiskUse: true })
      .limit(1)
      .toArray();
    let vehicleManufacturer = null;
    // Check
    if (vehicleManufacturersMDB && vehicleManufacturersMDB.length > 0) {
      // Create
      vehicleManufacturer = new VehicleManufacturer(tenantID, vehicleManufacturersMDB[0]);
    }
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'getVehicleManufacturer', uniqueTimerID, { id });
    return vehicleManufacturer;
  }

  static async saveVehicleManufacturer(tenantID, vehicleManufacturerToSave) {
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
    // Check Created/Last Changed By
    vehicleManufacturerToSave.createdBy = Utils.convertUserToObjectID(vehicleManufacturerToSave.createdBy);
    vehicleManufacturerToSave.lastChangedBy = Utils.convertUserToObjectID(vehicleManufacturerToSave.lastChangedBy);
    // Transfer
    const vehicleManufacturer: any = {};
    Database.updateVehicleManufacturer(vehicleManufacturerToSave, vehicleManufacturer, false);
    // Modify
    const result = await global.database.getCollection<any>(tenantID, 'vehiclemanufacturers').findOneAndUpdate(
      vehicleManufacturerFilter,
      { $set: vehicleManufacturer },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'saveVehicleManufacturer', uniqueTimerID, { vehicleManufacturerToSave });
    // Create
    return new VehicleManufacturer(tenantID, result.value);
  }

  // Delegate
  static async getVehicleManufacturers(tenantID, params: any = {}, limit?, skip?, sort?) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'getVehicleManufacturers');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
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
    }
    // Type?
    if (params.vehicleType) {
      aggregation.push({
        $match: { 'vehicles.type': params.vehicleType }
      });
    }
    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const vehiclemanufacturersCountMDB = await global.database.getCollection<any>(tenantID, 'vehiclemanufacturers')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
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
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
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
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });
    // Read DB
    const vehiclemanufacturersMDB = await global.database.getCollection<any>(tenantID, 'vehiclemanufacturers')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    const vehicleManufacturers = [];
    // Check
    if (vehiclemanufacturersMDB && vehiclemanufacturersMDB.length > 0) {
      // Create
      for (const vehicleManufacturerMDB of vehiclemanufacturersMDB) {
        // Create
        const vehicleManufacturer = new VehicleManufacturer(tenantID, vehicleManufacturerMDB);
        // Set Vehicles
        if (params.withVehicles && vehicleManufacturerMDB.vehicles) {
          // Add vehicles
          vehicleManufacturer.setVehicles(vehicleManufacturerMDB.vehicles.map((vehicle) => {
            return new Vehicle(tenantID, vehicle);
          }));
        }
        // Add
        vehicleManufacturers.push(vehicleManufacturer);
      }
    }
    // Debug
    Logging.traceEnd('VehicleManufacturerStorage', 'getVehicleManufacturers', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (vehiclemanufacturersCountMDB.length > 0 ?
        (vehiclemanufacturersCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : vehiclemanufacturersCountMDB[0].count) : 0),
      result: vehicleManufacturers
    };
  }

  static async deleteVehicleManufacturer(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleManufacturerStorage', 'deleteVehicleManufacturer');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Vehicles
    const vehicles = await VehicleStorage.getVehicles(tenantID, { 'vehicleManufacturerID': id });
    // Delete
    for (const vehicle of vehicles.result) {
      // Delete Vehicle
      await vehicle.delete();
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
