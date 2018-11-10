const ObjectID = require('mongodb').ObjectID;
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const AppError = require('../../exception/AppError');
const DatabaseUtils = require('./DatabaseUtils');
const BackendError = require('../../exception/BackendError');

class VehicleStorage {
  static async getVehicleImage(tenantID, id) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const vehicleImagesMDB = await global.database.getCollection(tenantID, 'vehicleimages')
      .find({_id: Utils.convertToObjectID(id)})
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
    return vehicleImage;
  }

  static async getVehicleImages(tenantID) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const vehicleImagesMDB = await global.database.getCollection(tenantID, 'vehicleimages')
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
    return vehicleImages;
  }

  static async getVehicle(tenantID, id) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Vehicle = require('../../entity/Vehicle'); // Avoid fucking circular deps!!!
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {_id: Utils.convertToObjectID(id)}
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID,aggregation);
    // Read DB
    const vehiclesMDB = await global.database.getCollection(tenantID, 'vehicles')
      .aggregate(aggregation)
      .toArray();
    // Set
    let vehicle = null;
    if (vehiclesMDB && vehiclesMDB.length > 0) {
      // Create
      vehicle = new Vehicle(tenantID, vehiclesMDB[0]);
    }
    return vehicle;
  }

  static async saveVehicle(tenantID, vehicleToSave) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Vehicle = require('../../entity/Vehicle'); // Avoid fucking circular deps!!!
    // Check if ID/Model is provided
    if (!vehicleToSave.id && !vehicleToSave.model) {
      // ID must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle has no ID and no Model`,
        550, "VehicleStorage", "saveVehicle");
    }
    const vehicleFilter = {};
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
    const vehicle = {};
    Database.updateVehicle(vehicleToSave, vehicle, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'vehicles').findOneAndUpdate(
      vehicleFilter,
      {$set: vehicle},
      {upsert: true, new: true, returnOriginal: false});
    // Create
    return new Vehicle(tenantID, result.value);
  }

  static async saveVehicleImages(tenantID, vehicleImagesToSave) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check if ID is provided
    if (!vehicleImagesToSave.id) {
      // ID must be provided!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle Images has no ID`,
        550, "VehicleStorage", "saveVehicleImages");
    }
    // Modify
    await global.database.getCollection(tenantID, 'vehicleimages').findOneAndUpdate(
      {'_id': Utils.convertToObjectID(vehicleImagesToSave.id)},
      {$set: {images: vehicleImagesToSave.images}},
      {upsert: true, new: true, returnOriginal: false});
  }

  // Delegate
  static async getVehicles(tenantID, params = {}, limit, skip, sort) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    const Vehicle = require('../../entity/Vehicle'); // Avoid fucking circular deps!!!
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Set the filters
    const filters = {};
    // Source?
    if (params.search) {
      // Build filter
      filters.$or = [
        {"model": {$regex: params.search, $options: 'i'}}
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
    // Count Records
    const vehiclesCountMDB = await global.database.getCollection(tenantID, 'vehicles')
      .aggregate([...aggregation, {$count: "count"}])
      .toArray();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID,aggregation);
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
    const vehiclesMDB = await global.database.getCollection(tenantID, 'vehicles')
      .aggregate(aggregation, {collation: {locale: Constants.DEFAULT_LOCALE, strength: 2}})
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
    // Ok
    return {
      count: (vehiclesCountMDB.length > 0 ? vehiclesCountMDB[0].count : 0),
      result: vehicles
    };
  }

  static async deleteVehicle(tenantID, id) {
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete Vehicle
    await global.database.getCollection(tenantID, 'vehicles')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
    // Delete Images
    await global.database.getCollection(tenantID, 'vehicleimages')
      .findOneAndDelete({'_id': Utils.convertToObjectID(id)});
  }
}

module.exports = VehicleStorage;
