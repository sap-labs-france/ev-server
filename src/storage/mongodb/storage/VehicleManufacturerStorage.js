const mongoose = require('mongoose');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const MDBVehicleManufacturer = require('../model/MDBVehicleManufacturer');
const VehicleManufacturer = require('../../../model/VehicleManufacturer');
const CarStorage = require('./CarStorage');
const Car = require('../../../model/Car');
const User = require('../../../model/User');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;
const MDBVehicleManufacturerLogo = require('../model/MDBVehicleManufacturerLogo');

let _centralRestServer;

class VehicleManufacturerStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetVehicleManufacturerLogo(id) {
		// Exec request
		return MDBVehicleManufacturerLogo.findById(id)
				.exec().then((vehicleManufacturerLogoMDB) => {
			let vehicleManufacturerLogo = null;
			// Set
			if (vehicleManufacturerLogoMDB) {
				vehicleManufacturerLogo = {
					id: vehicleManufacturerLogoMDB._id,
					logo: vehicleManufacturerLogoMDB.logo
				};
			}
			return vehicleManufacturerLogo;
		});
	}

	static handleGetVehicleManufacturerLogos() {
		// Exec request
		return MDBVehicleManufacturerLogo.find({})
				.exec().then((vehicleManufacturerLogosMDB) => {
			let vehicleManufacturerLogos = [];
			// Add
			vehicleManufacturerLogosMDB.forEach((vehicleManufacturerLogoMDB) => {
				vehicleManufacturerLogos.push({
					id: vehicleManufacturerLogoMDB._id,
					logo: vehicleManufacturerLogoMDB.logo
				});
			});
			return vehicleManufacturerLogos;
		});
	}

	static handleSaveVehicleManufacturerLogo(vehicleManufacturer) {
		// Check if ID/Name is provided
		if (!vehicleManufacturer.id) {
			// ID must be provided!
			return Promise.reject( new Error(
				"Error in saving the VehicleManufacturer: VehicleManufacturer has no ID and cannot be created or updated") );
		} else {
			// Save Logo
			return MDBVehicleManufacturerLogo.findOneAndUpdate({
				"_id": new ObjectId(vehicleManufacturer.id)
			}, vehicleManufacturer, {
				new: true,
				upsert: true
			});
			// Notify Change
			_centralRestServer.notifyVehicleManufacturerUpdated(
				{
					"id": vehicleManufacturer.id,
					"type": Constants.NOTIF_ENTITY_VEHICLE_MANUFACTURER
				}
			);
		}
	}

	static handleGetVehicleManufacturer(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: ObjectId(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Execute
		return MDBVehicleManufacturer.aggregate(aggregation)
				.exec().then((vehicleManufacturerMDB) => {
			let vehicleManufacturer = null;
			// Check
			if (vehicleManufacturerMDB && vehicleManufacturerMDB.length > 0) {
				// Create
				vehicleManufacturer = new VehicleManufacturer(vehicleManufacturerMDB[0]);
			}
			return vehicleManufacturer;
		});
	}

	static handleSaveVehicleManufacturer(vehicleManufacturer) {
		// Check if ID/Model is provided
		if (!vehicleManufacturer.id && !vehicleManufacturer.name) {
			// ID must be provided!
			return Promise.reject( new Error(
				"Error in saving the VehicleManufacturer: Vehicle Manufacturer has no ID and no Name and cannot be created or updated") );
		} else {
			let vehicleManufacturerFilter = {};
			// Build Request
			if (vehicleManufacturer.id) {
				vehicleManufacturerFilter._id = vehicleManufacturer.id;
			} else {
				vehicleManufacturerFilter._id = ObjectId();
			}
			// Check Created By
			if (vehicleManufacturer.createdBy && typeof vehicleManufacturer.createdBy == "object") {
				// This is the User Model
				vehicleManufacturer.createdBy = new ObjectId(vehicleManufacturer.createdBy.id);
			}
			// Check Last Changed By
			if (vehicleManufacturer.lastChangedBy && typeof vehicleManufacturer.lastChangedBy == "object") {
				// This is the User Model
				vehicleManufacturer.lastChangedBy = new ObjectId(vehicleManufacturer.lastChangedBy.id);
			}
			// Get
			let newVehicleManufacturer;
			return MDBVehicleManufacturer.findOneAndUpdate(vehicleManufacturerFilter, vehicleManufacturer, {
				new: true,
				upsert: true
			}).then((vehicleManufacturerMDB) => {
				newVehicleManufacturer = new VehicleManufacturer(vehicleManufacturerMDB);
				// Notify Change
				if (!vehicleManufacturer.id) {
					_centralRestServer.notifyVehicleManufacturerCreated(
						{
							"id": newVehicleManufacturer.getID(),
							"type": Constants.NOTIF_ENTITY_VEHICLE_MANUFACTURER
						}
					);
				} else {
					_centralRestServer.notifyVehicleManufacturerUpdated(
						{
							"id": newVehicleManufacturer.getID(),
							"type": Constants.NOTIF_ENTITY_VEHICLE_MANUFACTURER
						}
					);
				}
				return newVehicleManufacturer;
			});
		}
	}

	// Delegate
	static handleGetVehicleManufacturers(searchValue, withCars, numberOfVehicleManufacturers) {
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
		//  Cars
		aggregation.push({
			$lookup: {
				from: "cars",
				localField: "_id",
				foreignField: "vehicleManufacturerID",
				as: "cars"
			}
		});
		// Nbre of Cars
		aggregation.push({
			$addFields: {
				"numberOfCars": { $size: "$cars" }
			}
		});
		// With Cars
		if (withCars) {
			// Add Car Images
			aggregation.push({
				$lookup: {
					from: "carimages",
					localField: "cars._id",
					foreignField: "_id",
					as: "carImages"
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
		// Execute
		return MDBVehicleManufacturer.aggregate(aggregation)
				.exec().then((vehicleManufacturersMDB) => {
			let vehicleManufacturers = [];
			// Create
			vehicleManufacturersMDB.forEach((vehicleManufacturerMDB) => {
				// Create
				let vehicleManufacturer = new VehicleManufacturer(vehicleManufacturerMDB);
				// Set Cars
				if (withCars && vehicleManufacturerMDB.cars) {
					// Check images
					vehicleManufacturerMDB.cars.forEach((car) => {
						// Check images
						for (var i = 0; i < vehicleManufacturerMDB.carImages.length; i++) {
							// Compare
							if (vehicleManufacturerMDB.carImages[i]._id.equals(car._id)) {
								// Set the number of images
								car.numberOfImages = (vehicleManufacturerMDB.carImages[i].images ? vehicleManufacturerMDB.carImages[i].images.length : 0);
							}
						}
					});
					// Add cars
					vehicleManufacturer.setCars(vehicleManufacturerMDB.cars.map((car) => {
						return new Car(car);
					}));
				}
				// Add
				vehicleManufacturers.push(vehicleManufacturer);
			});
			return vehicleManufacturers;
		});
	}

	static handleDeleteVehicleManufacturer(id) {
		// Delete Cars
		return CarStorage.handleGetCars(null, id).then((cars) => {
			// Delete
			let proms = [];
			cars.forEach((car) => {
				//	Delete Car
				proms.push(car.delete());
			});
			// Execute all promises
			return Promise.all(proms);
		}).then((results) => {
			// Remove the VehicleManufacturer
			return MDBVehicleManufacturer.findByIdAndRemove(id);
		}).then((results) => {
			// Remove Logo
			return MDBVehicleManufacturerLogo.findByIdAndRemove(id);
		}).then((result) => {
			// Notify Change
			_centralRestServer.notifyVehicleManufacturerDeleted(
				{
					"id": id,
					"type": Constants.NOTIF_ENTITY_VEHICLE_MANUFACTURER
				}
			);
		});
	}
}

module.exports = VehicleManufacturerStorage;
