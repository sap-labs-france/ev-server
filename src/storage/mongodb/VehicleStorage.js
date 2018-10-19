const ObjectID = require('mongodb').ObjectID;
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const AppError = require('../../exception/AppError');

class VehicleStorage {
	static async getVehicleImage(tenant, id) {
		// Read DB
		const vehicleImagesMDB = await global.database.getCollection(tenant, 'vehicleimages')
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

	static async getVehicleImages(tenant) {
		// Read DB
		const vehicleImagesMDB = await global.database.getCollection(tenant, 'vehicleimages')
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

	static async getVehicle(tenant, id) {
		const Vehicle = require('../../entity/Vehicle'); // Avoid fucking circular deps!!!
		// Create Aggregation
		const aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Read DB
		const vehiclesMDB = await global.database.getCollection(tenant, 'vehicles')
			.aggregate(aggregation)
			.toArray();
		// Set
		let vehicle = null;
		if (vehiclesMDB && vehiclesMDB.length > 0) {
			// Create
			vehicle = new Vehicle(tenant, vehiclesMDB[0]);
		}
		return vehicle;
	}

	static async saveVehicle(tenant, vehicleToSave) {
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
	    const result = await global.database.getCollection(tenant, 'vehicles').findOneAndUpdate(
			vehicleFilter,
			{$set: vehicle},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new Vehicle(tenant, result.value);
	}

	static async saveVehicleImages(tenant, vehicleImagesToSave) {
		// Check if ID is provided
		if (!vehicleImagesToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Vehicle Images has no ID`,
				550, "VehicleStorage", "saveVehicleImages");
		}
		// Modify
	    await global.database.getCollection(tenant, 'vehicleimages').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(vehicleImagesToSave.id)},
			{$set: {images: vehicleImagesToSave.images}},
			{upsert: true, new: true, returnOriginal: false});
	}

	// Delegate
	static async getVehicles(tenant, params={}, limit, skip, sort) {
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
				{ "model" : { $regex : params.search, $options: 'i' } }
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
		const vehiclesCountMDB = await global.database.getCollection(tenant, 'vehicles')
			.aggregate([...aggregation, { $count: "count" }])
			.toArray();
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
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
					manufacturer : 1, model : 1
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
		const vehiclesMDB = await global.database.getCollection(tenant, 'vehicles')
			.aggregate(aggregation, { collation: { locale : Constants.DEFAULT_LOCALE, strength: 2 }})
			.toArray();
		const vehicles = [];
		// Check
		if (vehiclesMDB && vehiclesMDB.length > 0) {
			// Create
			for (const vehicleMDB of vehiclesMDB) {
				// Add
				vehicles.push(new Vehicle(tenant, vehicleMDB));
			}
		}
		// Ok
		return {
			count: (vehiclesCountMDB.length > 0 ? vehiclesCountMDB[0].count : 0),
			result: vehicles
		};
	}

	static async deleteVehicle(tenant, id) {
		// Delete Vehicle
		await global.database.getCollection(tenant, 'vehicles')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Images
		await global.database.getCollection(tenant, 'vehicleimages')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
	}
}

module.exports = VehicleStorage;
