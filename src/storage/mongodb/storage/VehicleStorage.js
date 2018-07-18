const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Vehicle = require('../../../model/Vehicle');
const AppError = require('../../../exception/AppError');
const ObjectID = require('mongodb').ObjectID;

let _db;

class VehicleStorage {
	static async setDatabase(db) {
		_db = db;
	}

	static async handleGetVehicleImage(id) {
		// Read DB
		let vehicleImagesMDB = await _db.collection('vehicleimages')
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

	static async handleGetVehicleImages() {
		// Read DB
		let vehicleImagesMDB = await _db.collection('vehicleimages')
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

	static async handleGetVehicle(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Read DB
		let vehiclesMDB = await _db.collection('vehicles')
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

	static async handleSaveVehicle(vehicleToSave) {
		// Check if ID/Model is provided
		if (!vehicleToSave.id && !vehicleToSave.model) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Vehicle has no ID and no Model`,
				550, "VehicleStorage", "handleSaveVehicle");
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
	    let result = await _db.collection('vehicles').findOneAndUpdate(
			vehicleFilter,
			{$set: vehicle},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new Vehicle(result.value);
	}

	static async handleSaveVehicleImages(vehicleImagesToSave) {
		// Check if ID is provided
		if (!vehicleImagesToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Vehicle Images has no ID`,
				550, "VehicleStorage", "handleSaveVehicleImages");
		}
		// Modify
	    await _db.collection('vehicleimages').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(vehicleImagesToSave.id)},
			{$set: {images: vehicleImagesToSave.images}},
			{upsert: true, new: true, returnOriginal: false});
	}

	// Delegate
	static async handleGetVehicles(searchValue, vehicleManufacturerID, vehicleType, numberOfVehicles) {
		// Check Limit
		numberOfVehicles = Utils.checkRecordLimit(numberOfVehicles);
		// Set the filters
		let filters = {};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$or = [
				{ "model" : { $regex : searchValue, $options: 'i' } }
			];
		}
		// Set Company?
		if (vehicleManufacturerID) {
			filters.vehicleManufacturerID = Utils.convertToObjectID(vehicleManufacturerID);
		}
		// Set Vehicle Type?
		if (vehicleType) {
			filters.type = vehicleType;
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Add Vehicle Images
		aggregation.push({
			$lookup: {
				from: "vehicleimages",
				localField: "_id",
				foreignField: "_id",
				as: "vehicleImages"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$vehicleImages", "preserveNullAndEmptyArrays": true }
		});
		aggregation.push({
			$addFields: {
				"numberOfImages": { $size: "$vehicleImages.images" }
			}
		});
		aggregation.push({
			$project: {
				"vehicleImages": 0
			}
		});
		// Sort
		aggregation.push({
			$sort: {
				manufacturer : 1,
				model : 1
			}
		});
		// Limit
		if (numberOfVehicles > 0) {
			aggregation.push({
				$limit: numberOfVehicles
			});
		}
		// Read DB
		let vehiclesMDB = await _db.collection('vehicles')
			.aggregate(aggregation)
			.toArray();
		let vehicles = [];
		// Check
		if (vehiclesMDB && vehiclesMDB.length > 0) {
			// Create
			vehiclesMDB.forEach((vehicleMDB) => {
				// Create
				let vehicle = new Vehicle(vehicleMDB);
				// Add
				vehicles.push(vehicle);
			});
		}
		return vehicles;
	}

	static async handleDeleteVehicle(id) {
		// Delete Vehicle
		await _db.collection('vehicles')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Images
		await _db.collection('vehicleimages')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
	}
}

module.exports = VehicleStorage;
