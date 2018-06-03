const mongoose = require('mongoose');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const MDBVehicle = require('../model/MDBVehicle');
const MDBVehicleImage = require('../model/MDBVehicleImage');
const MDBChargingStation = require('../model/MDBChargingStation');
const Vehicle = require('../../../model/Vehicle');
const ChargingStation = require('../../../model/ChargingStation');
const User = require('../../../model/User');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

let _centralRestServer;
let _db;

class VehicleStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static setDatabase(db) {
		_db = db;
	}

	static handleGetVehicleImage(id) {
		// Exec request
		return MDBVehicleImage.findById(id).exec().then((vehicleImageMDB) => {
			let vehicleImage = null;
			// Set
			if (vehicleImageMDB) {
				vehicleImage = {
					id: vehicleImageMDB._id,
					images: vehicleImageMDB.images
				};
			}
			return vehicleImage;
		});
	}

	static handleGetVehicleImages() {
		// Exec request
		return MDBVehicleImage.find({}).exec().then((vehicleImagesMDB) => {
			let vehicleImages = [];
			// Add
			vehicleImagesMDB.forEach((vehicleImageMDB) => {
				vehicleImages.push({
					id: vehicleImageMDB._id,
					images: vehicleImageMDB.images
				});
			});
			return vehicleImages;
		});
	}

	static handleGetVehicle(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: new ObjectId(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Execute
		return MDBVehicle.aggregate(aggregation)
				.exec().then((vehicleMDB) => {
			let vehicle = null;
			// Check
			if (vehicleMDB && vehicleMDB.length > 0) {
				// Create
				vehicle = new Vehicle(vehicleMDB[0]);
			}
			return vehicle;
		});
	}

	static handleSaveVehicle(vehicle) {
		// Check if ID/Model is provided
		if (!vehicle.id && !vehicle.model) {
			// ID must be provided!
			return Promise.reject( new Error(
				"Vehicle has no ID and no Model and cannot be created or updated") );
		} else {
			let vehicleFilter = {};
			// Build Request
			if (vehicle.id) {
				vehicleFilter._id = vehicle.id;
			} else {
				vehicleFilter._id = ObjectId();
			}
			// Check Created By
			if (vehicle.createdBy && typeof vehicle.createdBy == "object") {
				// This is the User Model
				vehicle.createdBy = new ObjectId(vehicle.createdBy.id);
			}
			// Check Last Changed By
			if (vehicle.lastChangedBy && typeof vehicle.lastChangedBy == "object") {
				// This is the User Model
				vehicle.lastChangedBy = new ObjectId(vehicle.lastChangedBy.id);
			}
			// Get
			let newVehicle;
			return MDBVehicle.findOneAndUpdate(vehicleFilter, vehicle, {
				new: true,
				upsert: true
			}).then((vehicleMDB) => {
				newVehicle = new Vehicle(vehicleMDB);
				// Notify Change
				if (!vehicle.id) {
					_centralRestServer.notifyVehicleCreated(
						{
							"id": newVehicle.getID(),
							"type": Constants.ENTITY_VEHICLE
						}
					);
				} else {
					_centralRestServer.notifyVehicleUpdated(
						{
							"id": newVehicle.getID(),
							"type": Constants.ENTITY_VEHICLE
						}
					);
				}
				return newVehicle;
			});
		}
	}

	static handleSaveVehicleImages(vehicle) {
		// Check if ID is provided
		if (!vehicle.id) {
			// ID must be provided!
			return Promise.reject( new Error("Vehicle has no ID cannot be created or updated") );
		} else {
			// Save Image
			return MDBVehicleImage.findOneAndUpdate({
				"_id": new ObjectId(vehicle.id)
			}, vehicle, {
				new: true,
				upsert: true
			});
			// Notify Change
			_centralRestServer.notifyVehicleUpdated(
				{
					"id": vehicle.id,
					"type": Constants.ENTITY_VEHICLE
				}
			);
		}
	}

	// Delegate
	static handleGetVehicles(searchValue, vehicleManufacturerID, vehicleType, numberOfVehicles) {
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
			filters.vehicleManufacturerID = new ObjectId(vehicleManufacturerID);
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
		// Execute
		return MDBVehicle.aggregate(aggregation)
				.exec().then((vehiclesMDB) => {
			let vehicles = [];
			// Create
			vehiclesMDB.forEach((vehicleMDB) => {
				// Create
				let vehicle = new Vehicle(vehicleMDB);
				// Add
				vehicles.push(vehicle);
			});
			return vehicles;
		});
	}

	static handleDeleteVehicle(id) {
		// Remove the Vehicle
		MDBVehicle.findByIdAndRemove(id).then((results) => {
			// Remove Image
			return MDBVehicleImage.findByIdAndRemove( id );
		}).then((result) => {
			// Notify Change
			_centralRestServer.notifyVehicleDeleted(
				{
					"id": id,
					"type": Constants.ENTITY_VEHICLE
				}
			);
			return;
		});
	}
}

module.exports = VehicleStorage;
