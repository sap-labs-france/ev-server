import Vehicle from '../../entity/Vehicle';
import { ObjectID } from 'mongodb';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import Utils from '../../utils/Utils';
import BackendError from '../../exception/BackendError';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import TSGlobal from '../../types/GlobalType';

declare const global: TSGlobal;

export default class VehicleStorage {

  static async getVehicleImage(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'getVehicleImage');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const vehicleImagesMDB = await global.database.getCollection<any>(tenantID, 'vehicleimages')
      .find({ _id: Utils.convertToObjectID(id) })
      .limit(1)
      .toArray();
    let vehicleImage = null;
    // Set
    if (vehicleImagesMDB && vehicleImagesMDB.length > 0) {
      vehicleImage = {
        id: vehicleImagesMDB[0]._id,
        images: vehicleImagesMDB[0].images
      };
    }
    // Debug
    Logging.traceEnd('VehicleStorage', 'getVehicleImage', uniqueTimerID, { id });
    return vehicleImage;
  }

  static async getVehicleImages(tenantID) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'getVehicleImages');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const vehicleImagesMDB = await global.database.getCollection<any>(tenantID, 'vehicleimages')
      .find({})
      .toArray();
    const vehicleImages = [];
    // Set
    if (vehicleImagesMDB && vehicleImagesMDB.length > 0) {
      // Add
      for (const vehicleImageMDB of vehicleImagesMDB) {
        vehicleImages.push({
          id: vehicleImageMDB._id,
          images: vehicleImageMDB.images
        });
      }
    }
    // Debug
    Logging.traceEnd('VehicleStorage', 'getVehicleImages', uniqueTimerID);
    return vehicleImages;
  }

  static async getVehicle(tenantID, id) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'getVehicle');
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
    const vehiclesMDB = await global.database.getCollection<any>(tenantID, 'vehicles')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Set
    let vehicle = null;
    if (vehiclesMDB && vehiclesMDB.length > 0) {
      // Create
      vehicle = new Vehicle(tenantID, vehiclesMDB[0]);
    }
    // Debug
    Logging.traceEnd('VehicleStorage', 'getVehicle', uniqueTimerID, { id });
    return vehicle;
  }

  static async saveVehicle(tenantID, vehicleToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'saveVehicle');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID/Model is provided
    if (!vehicleToSave.id && !vehicleToSave.model) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Vehicle has no ID and no Model`,
        "VehicleStorage", "saveVehicle");
    }
    const vehicleFilter: any = {};
    // Build Request
    if (vehicleToSave.id) {
      vehicleFilter._id = Utils.convertUserToObjectID(vehicleToSave.id);
    } else {
      vehicleFilter._id = new ObjectID();
    }
    // Set Created By
    vehicleToSave.createdBy = Utils.convertUserToObjectID(vehicleToSave.createdBy);
    vehicleToSave.lastChangedBy = Utils.convertUserToObjectID(vehicleToSave.lastChangedBy);
    // Transfer
    const vehicle: any = {};
    Database.updateVehicle(vehicleToSave, vehicle, false);
    // Modify
    const result = await global.database.getCollection<any>(tenantID, 'vehicles').findOneAndUpdate(
      vehicleFilter,
      { $set: vehicle },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('VehicleStorage', 'saveVehicle', uniqueTimerID, { vehicleToSave });
    // Create
    return new Vehicle(tenantID, result.value);
  }

  static async saveVehicleImages(tenantID, vehicleImagesToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'saveVehicleImages');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!vehicleImagesToSave.id) {
      // ID must be provided!
      throw new BackendError(
        Constants.CENTRAL_SERVER,
        `Vehicle Images has no ID`,
        "VehicleStorage", "saveVehicleImages");
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
  static async getVehicles(tenantID, params: any = {}, limit?, skip?, sort?) {
    // Debug
    const uniqueTimerID = Logging.traceStart('VehicleStorage', 'getVehicles');
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
        { "model": { $regex: params.search, $options: 'i' } }
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
    // Limit records?
    if (!params.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.MAX_DB_RECORD_COUNT });
    }
    // Count Records
    const vehiclesCountMDB = await global.database.getCollection<any>(tenantID, 'vehicles')
      .aggregate([...aggregation, { $count: "count" }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (params.onlyRecordCount) {
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
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
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
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });
    // Read DB
    const vehiclesMDB = await global.database.getCollection<any>(tenantID, 'vehicles')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    const vehicles = [];
    // Check
    if (vehiclesMDB && vehiclesMDB.length > 0) {
      // Create
      for (const vehicleMDB of vehiclesMDB) {
        // Add
        vehicles.push(new Vehicle(tenantID, vehicleMDB));
      }
    }
    // Debug
    Logging.traceEnd('VehicleStorage', 'getVehicles', uniqueTimerID, { params, limit, skip, sort });
    // Ok
    return {
      count: (vehiclesCountMDB.length > 0 ?
        (vehiclesCountMDB[0].count === Constants.MAX_DB_RECORD_COUNT ? -1 : vehiclesCountMDB[0].count) : 0),
      result: vehicles
    };
  }

  static async deleteVehicle(tenantID, id) {
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
