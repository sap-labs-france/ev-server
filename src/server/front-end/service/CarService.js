const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Cars = require('../../../utils/Cars');
const Constants = require('../../../utils/Constants');
const Utils = require('../../../utils/Utils');
const Car = require('../../../model/Car');
const CarSecurity = require('./security/CarSecurity');

class CarService {
	static handleDeleteCar(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CarService",
			method: "handleDeleteCar",
			message: `Delete Car '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let car;
		let filteredRequest = CarSecurity.filterCarDeleteRequest(
			req.query, req.user);
		// Check Mandatory fields
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Car's ID must be provided`), req, res, next);
			return;
		}
		// Get
		global.storage.getCar(filteredRequest.ID).then((foundCar) => {
			car = foundCar;
			// Found?
			if (!car) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Car with ID '${filteredRequest.ID}' does not exist`,
					550, "CarService", "handleDeleteCar");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteCar(req.user, car.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.ENTITY_CAR,
					car.getID(),
					560, "CarService", "handleDeleteCar",
					req.user);
			}
			// Delete
			return car.delete();
		}).then(() => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "CarService", method: "handleDeleteCar",
				message: `Car '${car.getName()}' has been deleted successfully`,
				action: action, detailedMessages: car});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCar(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CarService",
			method: "handleGetCar",
			message: `Read Car '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = CarSecurity.filterCarRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Car ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getCar(filteredRequest.ID).then((car) => {
			if (!car) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Car with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "CarService", "handleUpdateCar");
			}
			// Return
			res.json(
				// Filter
				CarSecurity.filterCarResponse(
					car.getModel(), req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCars(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CarService",
			method: "handleGetCars",
			message: `Read All Cars`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListCars(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_CARS,
				null,
				560, "CarService", "handleGetCars",
				req.user);
		}
		// Filter
		let filteredRequest = CarSecurity.filterCarsRequest(req.query, req.user);
		// Get the cars
		global.storage.getCars(filteredRequest.Search, Constants.NO_LIMIT).then((cars) => {
			let carsJSon = [];
			cars.forEach((car) => {
				// Set the model
				carsJSon.push(car.getModel());
			});
			// Return
			res.json(
				// Filter
				CarSecurity.filterCarsResponse(
					carsJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCarImage(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CarService",
			method: "handleGetCarImage",
			message: `Read Car Image '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = CarSecurity.filterCarRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Car ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getCar(filteredRequest.ID).then((car) => {
			if (!car) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Car with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "CarService", "handleUpdateCar");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadCar(req.user, car.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_CAR,
					car.getID(),
					560, "CarService", "handleGetCarImage",
					req.user);
			}
			// Get the image
			return global.storage.getCarImage(filteredRequest.ID);
		}).then((carImage) => {
			// Found?
			if (carImage) {
				Logging.logSecurityInfo({
					user: req.user,
					action: action,
					module: "CarService", method: "handleGetCarImage",
					message: 'Read Car Image'
				});
				// Set the user
				res.json(carImage);
			} else {
				res.json(null);
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCarImages(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CarService", method: "handleGetCarImages",
			message: `Read Car Images`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListCars(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_CARS,
				null,
				560, "CarService", "handleGetCarImages",
				req.user);
		}
		// Get the car image
		global.storage.getCarImages().then((carImages) => {
			Logging.logSecurityInfo({
				user: req.user,
				action: action,
				module: "CarService", method: "handleGetCarImages",
				message: 'Read Car Images'
			});
			res.json(carImages);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleCreateCar(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CarService",
			method: "handleCreateCar",
			message: `Create Car '${req.body.manufacturer} ${req.body.model}'`,
			detailedMessages: req.body
		});
		// Check auth
		if (!CentralRestServerAuthorization.canCreateCar(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_CREATE,
				CentralRestServerAuthorization.ENTITY_CAR,
				null,
				560, "CarService", "handleCreateCar",
				req.user);
		}
		// Filter
		let filteredRequest = CarSecurity.filterCarCreateRequest( req.body, req.user );
		// Check Mandatory fields
		if (Cars.checkIfCarValid(action, filteredRequest, req, res, next)) {
			let car, newCar;
			// Get the logged user
			global.storage.getUser(req.user.id).then((loggedUser) => {
				// Create car
				car = new Car(filteredRequest);
				// Update timestamp
				car.setCreatedBy(loggedUser);
				car.setCreatedOn(new Date());
				// Save
				return car.save();
			}).then((createdCar) => {
				newCar = createdCar;
				// Save Images?
				if (filteredRequest.withCarImages) {
					// Save Site's Image
					newCar.setImages(car.getImages());
					// Save
					return newCar.saveImages();
				}
			}).then(() => {
				Logging.logSecurityInfo({
					user: req.user, module: "CarService", method: "handleCreateCar",
					message: `Car '${newCar.getName()}' has been created successfully`,
					action: action, detailedMessages: newCar});
				// Ok
				res.json({status: `Success`});
				next();
			}).catch((err) => {
				// Log
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		}
	}

	static handleUpdateCar(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CarService",
			method: "handleUpdateCar",
			message: `Update Car '${req.body.model} ${req.body.manufacturer}' (ID '${req.body.id}')`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = CarSecurity.filterCarUpdateRequest( req.body, req.user );
		let car;
		// Check email
		global.storage.getCar(filteredRequest.id).then((foundCar) => {
			car = foundCar;
			if (!car) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Car with ID '${filteredRequest.id}' does not exist anymore`,
					550, "CarService", "handleUpdateCar");
			}
			// Check Mandatory fields
			if (!Cars.checkIfCarValid(action, filteredRequest, req, res, next)) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Car request is invalid`,
					500, "CarService", "handleUpdateCar");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canUpdateCar(req.user, car.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_UPDATE,
					CentralRestServerAuthorization.ENTITY_CAR,
					car.getID(),
					560, "CarService", "handleUpdateCar",
					req.user);
			}
			// Get the logged user
			return global.storage.getUser(req.user.id);
		// Logged User
		}).then((loggedUser) => {
			// Update
			Database.updateCar(filteredRequest, car.getModel());
			// Update timestamp
			car.setLastChangedBy(loggedUser);
			car.setLastChangedOn(new Date());
			// Update
			return car.save();
		}).then((updatedCar) => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "CarService", method: "handleUpdateCar",
				message: `Car '${updatedCar.getName()}' has been updated successfully`,
				action: action, detailedMessages: updatedCar});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = CarService;
