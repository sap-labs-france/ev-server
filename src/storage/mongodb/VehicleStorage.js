const ObjectID = require('mongodb').ObjectID;
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const AppError = require('../../exception/AppError');

class VehicleStorage {
	static async getVehicleImage(id) {
		// Read DB
		let vehicleImagesMDB = await global.db.collection('vehicleimages')
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

	static async getVehicleImages() {
		// Read DB
		let vehicleImagesMDB = await global.db.collection('vehicleimages')
			.find({})
			.toArray();
		let vehicleImages = [];
		// Set
		if (vehicleImagesMDB && vehicleImagesMDB.length > 0) {
			// Add
			vehicleImagesMDB.forEach((vehicleImageMDB) => {
				vehicleImages.push({
					id: vehicleImageMDB._id,
					images: vehicleImageMDB.images
				});
			});
		}
		return vehicleImages;
	}

	static async getVehicle(id) {
		const Vehicle = require('../../model/Vehicle'); // Avoid fucking circular deps!!!
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Read DB
		let vehiclesMDB = await global.db.collection('vehicles')
			.aggregate(aggregation)
			.toArray();
		// Set
		let vehicle = null;
		if (vehiclesMDB && vehiclesMDB.length > 0) {
			// Create
			vehicle = new Vehicle(vehiclesMDB[0]);
		}
		return vehicle;
	}

	static async saveVehicle(vehicleToSave) {
		const Vehicle = require('../../model/Vehicle'); // Avoid fucking circular deps!!!
		// Check if ID/Model is provided
		if (!vehicleToSave.id && !vehicleToSave.model) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Vehicle has no ID and no Model`,
				550, "VehicleStorage", "saveVehicle");
		}
		let vehicleFilter = {};
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
		let vehicle = {};
		Database.updateVehicle(vehicleToSave, vehicle, false);
		// Modify
	    let result = await global.db.collection('vehicles').findOneAndUpdate(
			vehicleFilter,
			{$set: vehicle},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new Vehicle(result.value);
	}

	static async saveVehicleImages(vehicleImagesToSave) {
		// Check if ID is provided
		if (!vehicleImagesToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Vehicle Images has no ID`,
				550, "VehicleStorage", "saveVehicleImages");
		}
		// Modify
	    await global.db.collection('vehicleimages').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(vehicleImagesToSave.id)},
			{$set: {images: vehicleImagesToSave.images}},
			{upsert: true, new: true, returnOriginal: false});
	}

	// Delegate
	static async getVehicles(params, limit, skip, sort) {
		const Vehicle = require('../../model/Vehicle'); // Avoid fucking circular deps!!!
		// Check Limit
		limit = Utils.checkRecordLimit(limit);
		// Check Skip
		skip = Utils.checkRecordSkip(skip);
		// Set the filters
		let filters = {};
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
		let aggregation = [];
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Count Records
		let vehiclesCountMDB = await global.db.collection('vehicles')
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
		let vehiclesMDB = await global.db.collection('vehicles')
			.aggregate(aggregation)
			.toArray();
		let vehicles = [];
		// Check
		if (vehiclesMDB && vehiclesMDB.length > 0) {
			// Create
			vehiclesMDB.forEach((vehicleMDB) => {
				// Add
				vehicles.push(new Vehicle(vehicleMDB));
			});
		}
		// Ok
		return {
			count: (vehiclesCountMDB.length > 0 ? vehiclesCountMDB[0].count : 0),
			result: vehicles
		};
	}

	static async deleteVehicle(id) {
		// Delete Vehicle
		await global.db.collection('vehicles')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Images
		await global.db.collection('vehicleimages')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
	}
}

module.exports = VehicleStorage;
