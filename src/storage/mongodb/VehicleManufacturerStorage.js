const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const VehicleStorage = require('./VehicleStorage');
const AppError = require('../../exception/AppError');
const ObjectID = require('mongodb').ObjectID;

class VehicleManufacturerStorage {
	static async getVehicleManufacturerLogo(tenant, id) {
		// Read DB
		const vehicleManufacturerLogosMDB = await global.database.getCollection(tenant, 'vehiclemanufacturerlogos')
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

	static async getVehicleManufacturerLogos(tenant) {
		// Read DB
		const vehicleManufacturerLogosMDB = await global.database.getCollection(tenant, 'vehiclemanufacturerlogos')
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
		return vehicleManufacturerLogos;
	}

	static async saveVehicleManufacturerLogo(tenant, vehicleManufacturerLogoToSave) {
		// Check if ID/Name is provided
		if (!vehicleManufacturerLogoToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Vehicle Manufacturer Logo has no ID`,
				550, "VehicleManufacturerStorage", "saveVehicleManufacturerLogo");
		}
		// Modify
	    await global.database.getCollection(tenant, 'vehiclemanufacturerlogos').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(vehicleManufacturerLogoToSave.id)},
			{$set: {logo: vehicleManufacturerLogoToSave.logo}},
			{upsert: true, new: true, returnOriginal: false});
	}

	static async getVehicleManufacturer(tenant, id) {
		const VehicleManufacturer = require('../../entity/VehicleManufacturer'); // Avoid fucking circular deps!!!
		// Create Aggregation
		const aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: Utils.convertToObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Read DB
		const vehicleManufacturersMDB = await global.database.getCollection(tenant, 'vehiclemanufacturers')
			.aggregate(aggregation)
			.limit(1)
			.toArray();
		let vehicleManufacturer = null;
		// Check
		if (vehicleManufacturersMDB && vehicleManufacturersMDB.length > 0) {
			// Create
			vehicleManufacturer = new VehicleManufacturer(tenant, vehicleManufacturersMDB[0]);
		}
		return vehicleManufacturer;
	}

	static async saveVehicleManufacturer(tenant, vehicleManufacturerToSave) {
		const VehicleManufacturer = require('../../entity/VehicleManufacturer'); // Avoid fucking circular deps!!!
		// Check if ID/Model is provided
		if (!vehicleManufacturerToSave.id && !vehicleManufacturerToSave.name) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Vehicle Manufacturer has no ID and no Name`,
				550, "VehicleManufacturerStorage", "saveVehicleManufacturer");
		}
		const vehicleManufacturerFilter = {};
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
		const vehicleManufacturer = {};
		Database.updateVehicleManufacturer(vehicleManufacturerToSave, vehicleManufacturer, false);
		// Modify
	    const result = await global.database.getCollection(tenant, 'vehiclemanufacturers').findOneAndUpdate(
			vehicleManufacturerFilter,
			{$set: vehicleManufacturer},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		return new VehicleManufacturer(tenant, result.value);
	}

	// Delegate
	static async getVehicleManufacturers(tenant, params={}, limit, skip, sort) {
		const VehicleManufacturer = require('../../entity/VehicleManufacturer'); // Avoid fucking circular deps!!!
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
				{ "name" : { $regex : params.search, $options: 'i' } }
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
		// Count Records
		const vehiclemanufacturersCountMDB = await global.database.getCollection(tenant, 'vehiclemanufacturers')
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
		const vehiclemanufacturersMDB = await global.database.getCollection(tenant, 'vehiclemanufacturers')
			.aggregate(aggregation, { collation: { locale : Constants.DEFAULT_LOCALE, strength: 2 }})
			.toArray();
		const vehicleManufacturers = [];
		// Check
		if (vehiclemanufacturersMDB && vehiclemanufacturersMDB.length > 0) {
			// Create
			for (const vehicleManufacturerMDB of vehiclemanufacturersMDB) {
				// Create
				const vehicleManufacturer = new VehicleManufacturer(tenant, vehicleManufacturerMDB);
				// Set Vehicles
				if (params.withVehicles && vehicleManufacturerMDB.vehicles) {
					// Add vehicles
					vehicleManufacturer.setVehicles(vehicleManufacturerMDB.vehicles.map((vehicle) => {
						return new Vehicle(tenant, vehicle);
					}));
				}
				// Add
				vehicleManufacturers.push(vehicleManufacturer);
			}
		}
		// Ok
		return {
			count: (vehiclemanufacturersCountMDB.length > 0 ? vehiclemanufacturersCountMDB[0].count : 0),
			result: vehicleManufacturers
		};
	}

	static async deleteVehicleManufacturer(tenant, id) {
		// Delete Vehicles
		const vehicles = await VehicleStorage.getVehicles(null, id);
		// Delete
		for (const vehicle of vehicles.result) {
			//	Delete Vehicle
			await vehicle.delete();
		}
		// Delete the Vehicle Manufacturers
		await global.database.getCollection(tenant, 'vehiclemanufacturers')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Vehicle Manufacturer Logo
		await global.database.getCollection(tenant, 'vehiclemanufacturerlogos')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
	}
}

module.exports = VehicleManufacturerStorage;
