const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const VehicleStorage = require('./VehicleStorage');
const AppError = require('../../exception/AppError');
const ObjectID = require('mongodb').ObjectID;

class VehicleManufacturerStorage {
	static async getVehicleManufacturerLogo(id) {
		// Read DB
		let vehicleManufacturerLogosMDB = await global.db.collection('vehiclemanufacturerlogos')
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

	static async getVehicleManufacturerLogos() {
		// Read DB
		let vehicleManufacturerLogosMDB = await global.db.collection('vehiclemanufacturerlogos')
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

	static async saveVehicleManufacturerLogo(vehicleManufacturerLogoToSave) {
		// Check if ID/Name is provided
		if (!vehicleManufacturerLogoToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Vehicle Manufacturer Logo has no ID`,
				550, "VehicleManufacturerStorage", "saveVehicleManufacturerLogo");
		}
		// Modify
	    await global.db.collection('vehiclemanufacturerlogos').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(vehicleManufacturerLogoToSave.id)},
			{$set: {logo: vehicleManufacturerLogoToSave.logo}},
			{upsert: true, new: true, returnOriginal: false});
	}

	static async getVehicleManufacturer(id) {
		const VehicleManufacturer = require('../../model/VehicleManufacturer'); // Avoid fucking circular deps!!!
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Read DB
		let vehicleManufacturersMDB = await global.db.collection('vehiclemanufacturers')
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

	static async saveVehicleManufacturer(vehicleManufacturerToSave) {
		const VehicleManufacturer = require('../../model/VehicleManufacturer'); // Avoid fucking circular deps!!!
		// Check if ID/Model is provided
		if (!vehicleManufacturerToSave.id && !vehicleManufacturerToSave.name) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Vehicle Manufacturer has no ID and no Name`,
				550, "VehicleManufacturerStorage", "saveVehicleManufacturer");
		}
		let vehicleManufacturerFilter = {};
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
		let vehicleManufacturer = {};
		Database.updateVehicleManufacturer(vehicleManufacturerToSave, vehicleManufacturer, false);
		// Modify
	    let result = await global.db.collection('vehiclemanufacturers').findOneAndUpdate(
			vehicleManufacturerFilter,
			{$set: vehicleManufacturer},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new VehicleManufacturer(result.value);
	}

	// Delegate
	static async getVehicleManufacturers(params, limit, skip, sort) {
		const VehicleManufacturer = require('../../model/VehicleManufacturer'); // Avoid fucking circular deps!!!
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
				{ "name" : { $regex : params.search, $options: 'i' } }
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
		// With Vehicles
		if (params.withVehicles || params.vehicleType) {
			//  Vehicles
			aggregation.push({
				$lookup: {
					from: "vehicles",
					localField: "_id",
					foreignField: "vehicleManufacturerID",
					as: "vehicles"
				}
			});
		}
		// Type?
		if (params.vehicleType) {
			aggregation.push({
				$match: { "vehicles.type": params.vehicleType }
			});
		}
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
					name : 1
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
		let vehiclemanufacturersMDB = await global.db.collection('vehiclemanufacturers')
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
				if (params.withVehicles && vehicleManufacturerMDB.vehicles) {
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

	static async deleteVehicleManufacturer(id) {
		// Delete Vehicles
		let vehicles = await VehicleStorage.getVehicles(null, id);
		// Delete
		vehicles.forEach(async (vehicle) => {
			//	Delete Vehicle
			await vehicle.delete();
		});
		// Delete the Vehicle Manufacturers
		await global.db.collection('vehiclemanufacturers')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Vehicle Manufacturer Logo
		await global.db.collection('vehiclemanufacturerlogos')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
	}
}

module.exports = VehicleManufacturerStorage;
