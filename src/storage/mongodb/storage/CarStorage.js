const mongoose = require('mongoose');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const MDBCar = require('../model/MDBCar');
const MDBCarImage = require('../model/MDBCarImage');
const MDBChargingStation = require('../model/MDBChargingStation');
const Car = require('../../../model/Car');
const ChargingStation = require('../../../model/ChargingStation');
const User = require('../../../model/User');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

let _centralRestServer;

class CarStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetCarImage(id) {
		// Exec request
		return MDBCarImage.findById(id).exec().then((carImageMDB) => {
			let carImage = null;
			// Set
			if (carImageMDB) {
				carImage = {
					id: carImageMDB._id,
					images: carImageMDB.images
				};
			}
			return carImage;
		});
	}

	static handleGetCarImages() {
		// Exec request
		return MDBCarImage.find({}).exec().then((carImagesMDB) => {
			let carImages = [];
			// Add
			carImagesMDB.forEach((carImageMDB) => {
				carImages.push({
					id: carImageMDB._id,
					images: carImageMDB.images
				});
			});
			return carImages;
		});
	}

	static handleGetCar(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: ObjectId(id) }
		});
		// Execute
		return MDBCar.aggregate(aggregation)
				.exec().then((carMDB) => {
			let car = null;
			// Check
			if (carMDB && carMDB.length > 0) {
				// Create
				car = new Car(carMDB[0]);
			}
			return car;
		});
	}

	static handleSaveCar(car) {
		// Check if ID/Model is provided
		if (!car.id && !car.model) {
			// ID must be provided!
			return Promise.reject( new Error(
				"Error in saving the Car: Car has no ID and no Model and cannot be created or updated") );
		} else {
			let carFilter = {};
			// Build Request
			if (car.id) {
				carFilter._id = car.id;
			} else {
				carFilter._id = ObjectId();
			}
			// Check Created By
			if (car.createdBy && typeof car.createdBy == "object") {
				// This is the User Model
				car.createdBy = new ObjectId(car.createdBy.id);
			}
			// Check Last Changed By
			if (car.lastChangedBy && typeof car.lastChangedBy == "object") {
				// This is the User Model
				car.lastChangedBy = new ObjectId(car.lastChangedBy.id);
			}
			// Get
			let newCar;
			return MDBCar.findOneAndUpdate(carFilter, car, {
				new: true,
				upsert: true
			}).then((carMDB) => {
				newCar = new Car(carMDB);
				// Notify Change
				if (!car.id) {
					_centralRestServer.notifyCarCreated(
						{
							"id": newCar.getID(),
							"type": Constants.NOTIF_ENTITY_CAR
						}
					);
				} else {
					_centralRestServer.notifyCarUpdated(
						{
							"id": newCar.getID(),
							"type": Constants.NOTIF_ENTITY_CAR
						}
					);
				}
				return newCar;
			});
		}
	}

	static handleSaveCarImages(car) {
		// Check if ID is provided
		if (!car.id) {
			// ID must be provided!
			return Promise.reject( new Error("Error in saving the Car: Car has no ID cannot be created or updated") );
		} else {
			// Save Image
			return MDBCarImage.findOneAndUpdate({
				"_id": new ObjectId(car.id)
			}, car, {
				new: true,
				upsert: true
			});
			// Notify Change
			_centralRestServer.notifyCarUpdated(
				{
					"id": car.id,
					"type": Constants.NOTIF_ENTITY_CAR
				}
			);
		}
	}

	// Delegate
	static handleGetCars(searchValue, numberOfCars) {
		// Check Limit
		numberOfCars = Utils.checkRecordLimit(numberOfCars);
		// Set the filters
		let filters = {};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$or = [
				{ "model" : { $regex : searchValue, $options: 'i' } },
				{ "manufacturer" : { $regex : searchValue, $options: 'i' } }
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
		// Created By
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "createdBy",
				foreignField: "_id",
				as: "createdBy"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$createdBy", "preserveNullAndEmptyArrays": true }
		});
		// Last Changed By
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "lastChangedBy",
				foreignField: "_id",
				as: "lastChangedBy"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$lastChangedBy", "preserveNullAndEmptyArrays": true }
		});
		// Add Car Images
		aggregation.push({
			$lookup: {
				from: "carimages",
				localField: "_id",
				foreignField: "_id",
				as: "carImages"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$carImages", "preserveNullAndEmptyArrays": true }
		});
		aggregation.push({
			$addFields: {
				"numberOfImages": { $size: "$carImages.images" }
			}
		});
		aggregation.push({
			$project: {
				"carImages.images": 0
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
		if (numberOfCars > 0) {
			aggregation.push({
				$limit: numberOfCars
			});
		}
		// Execute
		return MDBCar.aggregate(aggregation)
				.exec().then((carsMDB) => {
			let cars = [];
			// Create
			carsMDB.forEach((carMDB) => {
				// Create
				let car = new Car(carMDB);
				// Add
				cars.push(car);
			});
			return cars;
		});
	}

	static handleDeleteCar(id) {
		// Remove the Car
		MDBCar.findByIdAndRemove(id).then((results) => {
			// Remove Image
			return MDBCarImage.findByIdAndRemove( id );
		}).then((result) => {
			// Notify Change
			_centralRestServer.notifyCarDeleted(
				{
					"id": id,
					"type": Constants.NOTIF_ENTITY_CAR
				}
			);
			return;
		});
	}
}

module.exports = CarStorage;
