const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const VehicleManufacturer = require('../../../model/VehicleManufacturer');
const VehicleStorage = require('./VehicleStorage');
const Vehicle = require('../../../model/Vehicle');
const User = require('../../../model/User');
const crypto = require('crypto');
const ObjectID = require('mongodb').ObjectID;

let _db;

class VehicleManufacturerStorage {
	static setDatabase(db) {
		_db = db;
	}

	static async handleGetVehicleManufacturerLogo(id) {
		// Read DB
		let vehicleManufacturerLogosMDB = await _db.collection('vehiclemanufacturerlogos')
			.find({_id: Utils.convertToObjectID(id)})
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
		return vehicleManufacturerLogo;
	}

	static async handleGetVehicleManufacturerLogos() {
		// Read DB
		let vehicleManufacturerLogosMDB = await _db.collection('vehiclemanufacturerlogos')
			.find()
			.toArray();
		let vehicleManufacturerLogos = [];
		// Check
		if (vehicleManufacturerLogosMDB && vehicleManufacturerLogosMDB.length > 0) {
			// Add
			vehicleManufacturerLogosMDB.forEach((vehicleManufacturerLogoMDB) => {
				vehicleManufacturerLogos.push({
					id: vehicleManufacturerLogoMDB._id,
					logo: vehicleManufacturerLogoMDB.logo
				});
			});
		}
		return vehicleManufacturerLogos;
	}

	static async handleSaveVehicleManufacturerLogo(vehicleManufacturerLogoToSave) {
		// Check if ID/Name is provided
		if (!vehicleManufacturerLogoToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Vehicle Manufacturer Logo has no ID`,
				550, "VehicleManufacturerStorage", "handleSaveVehicleManufacturerLogo");
		}
		// Modify
	    await _db.collection('vehiclemanufacturerlogos').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(vehicleManufacturerLogoToSave.id)},
			{$set: {logo: vehicleManufacturerLogoToSave.logo}},
			{upsert: true, new: true, returnOriginal: false});
	}

	static async handleGetVehicleManufacturer(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Read DB
		let vehicleManufacturersMDB = await _db.collection('vehiclemanufacturers')
			.aggregate(aggregation)
			.limit(1)
			.toArray();
		let vehicleManufacturer = null;
		// Check
		if (vehicleManufacturersMDB && vehicleManufacturersMDB.length > 0) {
			// Create
			vehicleManufacturer = new VehicleManufacturer(vehicleManufacturersMDB[0]);
		}
		return vehicleManufacturer;
	}

	static async handleSaveVehicleManufacturer(vehicleManufacturerToSave) {
		// Check if ID/Model is provided
		if (!vehicleManufacturerToSave.id && !vehicleManufacturerToSave.name) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Vehicle Manufacturer has no ID and no Name`,
				550, "VehicleManufacturerStorage", "handleSaveVehicleManufacturer");
		}
		let vehicleManufacturerFilter = {};
		// Build Request
		if (vehicleManufacturerToSave.id) {
			vehicleManufacturerFilter._id = Utils.convertToObjectID(vehicleManufacturerToSave.id);
		} else {
			vehicleManufacturerFilter._id = new ObjectID();
		}
		// Check Created By/On
		vehicleManufacturerToSave.createdBy = Utils.ensureIsUserObjectID(vehicleManufacturerToSave.createdBy);
		vehicleManufacturerToSave.createdOn = Utils.convertToDate(vehicleManufacturerToSave.createdOn);
		// Check Last Changed By/On
		vehicleManufacturerToSave.lastChangedBy = Utils.ensureIsUserObjectID(vehicleManufacturerToSave.lastChangedBy);
		vehicleManufacturerToSave.lastChangedOn = Utils.convertToDate(vehicleManufacturerToSave.lastChangedOn);
		// Transfer
		let vehicleManufacturer = {};
		Database.updateVehicleManufacturer(vehicleManufacturerToSave, vehicleManufacturer, false);
		// Modify
	    let result = await _db.collection('vehiclemanufacturers').findOneAndUpdate(
			vehicleManufacturerFilter,
			{$set: vehicleManufacturer},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new VehicleManufacturer(result.value);
	}

	// Delegate
	static async handleGetVehicleManufacturers(searchValue, withVehicles, vehicleType, numberOfVehicleManufacturers) {
		// Check Limit
		numberOfVehicleManufacturers = Utils.checkRecordLimit(numberOfVehicleManufacturers);
		// Set the filters
		let filters = {};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$or = [
				{ "name" : { $regex : searchValue, $options: 'i' } }
			];
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		//  Vehicles
		aggregation.push({
			$lookup: {
				from: "vehicles",
				localField: "_id",
				foreignField: "vehicleManufacturerID",
				as: "vehicles"
			}
		});
		// Nbre of Vehicles
		aggregation.push({
			$addFields: {
				"numberOfVehicles": { $size: "$vehicles" }
			}
		});
		// With Vehicles
		if (withVehicles) {
			// Type?
			if (vehicleType) {
				aggregation.push({
					$match: { "vehicles.type" : vehicleType }
				});
			}
			// Add Vehicle Images
			aggregation.push({
				$lookup: {
					from: "vehicleimages",
					localField: "vehicles._id",
					foreignField: "_id",
					as: "vehicleImages"
				}
			});
		}
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Sort
		aggregation.push({
			$sort: {
				name : 1
			}
		});
		// Limit
		if (numberOfVehicleManufacturers > 0) {
			aggregation.push({
				$limit: numberOfVehicleManufacturers
			});
		}
		// Read DB
		let vehiclemanufacturersMDB = await _db.collection('vehiclemanufacturers')
			.aggregate(aggregation)
			.toArray();
		let vehicleManufacturers = [];
		// Check
		if (vehiclemanufacturersMDB && vehiclemanufacturersMDB.length > 0) {
			// Create
			vehiclemanufacturersMDB.forEach((vehicleManufacturerMDB) => {
				// Create
				let vehicleManufacturer = new VehicleManufacturer(vehicleManufacturerMDB);
				// Set Vehicles
				if (withVehicles && vehicleManufacturerMDB.vehicles) {
					// Check images
					vehicleManufacturerMDB.vehicles.forEach((vehicle) => {
						// Check images
						for (var i = 0; i < vehicleManufacturerMDB.vehicleImages.length; i++) {
							// Compare
							if (vehicleManufacturerMDB.vehicleImages[i]._id.equals(vehicle._id)) {
								// Set the number of images
								vehicle.numberOfImages = (vehicleManufacturerMDB.vehicleImages[i].images ? vehicleManufacturerMDB.vehicleImages[i].images.length : 0);
							}
						}
					});
					// Add vehicles
					vehicleManufacturer.setVehicles(vehicleManufacturerMDB.vehicles.map((vehicle) => {
						return new Vehicle(vehicle);
					}));
				}
				// Add
				vehicleManufacturers.push(vehicleManufacturer);
			});
		}
		return vehicleManufacturers;
	}

	static async handleDeleteVehicleManufacturer(id) {
		// Delete Vehicles
		let vehicles = await VehicleStorage.handleGetVehicles(null, id);
		// Delete
		vehicles.forEach(async (vehicle) => {
			//	Delete Vehicle
			await vehicle.delete();
		});
		// Delete the Vehicle Manufacturers
		await _db.collection('vehiclemanufacturers')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Vehicle Manufacturer Logo
		await _db.collection('vehiclemanufacturerlogos')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
	}
}

module.exports = VehicleManufacturerStorage;
