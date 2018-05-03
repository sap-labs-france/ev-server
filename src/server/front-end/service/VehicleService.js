const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Vehicles = require('../../../utils/Vehicles');
const Constants = require('../../../utils/Constants');
const Utils = require('../../../utils/Utils');
const Vehicle = require('../../../model/Vehicle');
const VehicleSecurity = require('./security/VehicleSecurity');

class VehicleService {
	static handleDeleteVehicle(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleService",
			method: "handleDeleteVehicle",
			message: `Delete Vehicle '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let vehicle;
		let filteredRequest = VehicleSecurity.filterVehicleDeleteRequest(
			req.query, req.user);
		// Check Mandatory fields
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Vehicle's ID must be provided`), req, res, next);
			return;
		}
		// Get
		global.storage.getVehicle(filteredRequest.ID).then((foundVehicle) => {
			vehicle = foundVehicle;
			// Found?
			if (!vehicle) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Vehicle with ID '${filteredRequest.ID}' does not exist`,
					550, "VehicleService", "handleDeleteVehicle");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteVehicle(req.user, vehicle.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.ENTITY_VEHICLE,
					vehicle.getID(),
					560, "VehicleService", "handleDeleteVehicle",
					req.user);
			}
			// Delete
			return vehicle.delete();
		}).then(() => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "VehicleService", method: "handleDeleteVehicle",
				message: `Vehicle '${vehicle.getName()}' has been deleted successfully`,
				action: action, detailedMessages: vehicle});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetVehicle(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleService",
			method: "handleGetVehicle",
			message: `Read Vehicle '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = VehicleSecurity.filterVehicleRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Vehicle ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getVehicle(filteredRequest.ID).then((vehicle) => {
			if (!vehicle) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "VehicleService", "handleGetVehicle");
			}
			// Return
			res.json(
				// Filter
				VehicleSecurity.filterVehicleResponse(
					vehicle.getModel(), req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetVehicles(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleService",
			method: "handleGetVehicles",
			message: `Read All Vehicles`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListVehicles(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_VEHICLES,
				null,
				560, "VehicleService", "handleGetVehicles",
				req.user);
		}
		// Filter
		let filteredRequest = VehicleSecurity.filterVehiclesRequest(req.query, req.user);
		// Get the vehicles
		global.storage.getVehicles(filteredRequest.Search, null, Constants.NO_LIMIT).then((vehicles) => {
			let vehiclesJSon = [];
			vehicles.forEach((vehicle) => {
				// Set the model
				vehiclesJSon.push(vehicle.getModel());
			});
			// Return
			res.json(
				// Filter
				VehicleSecurity.filterVehiclesResponse(
					vehiclesJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetVehicleImage(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleService",
			method: "handleGetVehicleImage",
			message: `Read Vehicle Image '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = VehicleSecurity.filterVehicleRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Vehicle ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getVehicle(filteredRequest.ID).then((vehicle) => {
			if (!vehicle) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "VehicleService", "handleGetVehicleImage");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadVehicle(req.user, vehicle.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_VEHICLE,
					vehicle.getID(),
					560, "VehicleService", "handleGetVehicleImage",
					req.user);
			}
			// Get the image
			return global.storage.getVehicleImage(filteredRequest.ID);
		}).then((vehicleImage) => {
			// Found?
			if (vehicleImage) {
				Logging.logSecurityInfo({
					user: req.user,
					action: action,
					module: "VehicleService", method: "handleGetVehicleImage",
					message: 'Read Vehicle Image'
				});
				// Set the user
				res.json(vehicleImage);
			} else {
				res.json(null);
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetVehicleImages(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleService", method: "handleGetVehicleImages",
			message: `Read Vehicle Images`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListVehicles(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_VEHICLES,
				null,
				560, "VehicleService", "handleGetVehicleImages",
				req.user);
		}
		// Get the vehicle image
		global.storage.getVehicleImages().then((vehicleImages) => {
			Logging.logSecurityInfo({
				user: req.user,
				action: action,
				module: "VehicleService", method: "handleGetVehicleImages",
				message: 'Read Vehicle Images'
			});
			res.json(vehicleImages);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleCreateVehicle(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleService",
			method: "handleCreateVehicle",
			message: `Create Vehicle '${req.body.manufacturer} ${req.body.model}'`,
			detailedMessages: req.body
		});
		// Check auth
		if (!CentralRestServerAuthorization.canCreateVehicle(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_CREATE,
				CentralRestServerAuthorization.ENTITY_VEHICLE,
				null,
				560, "VehicleService", "handleCreateVehicle",
				req.user);
		}
		// Filter
		let filteredRequest = VehicleSecurity.filterVehicleCreateRequest( req.body, req.user );
		let vehicle, newVehicle;
		// Get the logged user
		global.storage.getUser(req.user.id).then((loggedUser) => {
			// Check Mandatory fields
			Vehicles.checkIfVehicleValid(filteredRequest, req);
			// Create vehicle
			vehicle = new Vehicle(filteredRequest);
			// Update timestamp
			vehicle.setCreatedBy(loggedUser);
			vehicle.setCreatedOn(new Date());
			// Save
			return vehicle.save();
		}).then((createdVehicle) => {
			newVehicle = createdVehicle;
			// Save Site's Image
			if (vehicle.getImages()) {
				newVehicle.setImages(vehicle.getImages());
			} else {
				newVehicle.setImages([]);
			}
			// Save
			return newVehicle.saveImages();
		}).then(() => {
			Logging.logSecurityInfo({
				user: req.user, module: "VehicleService", method: "handleCreateVehicle",
				message: `Vehicle '${newVehicle.getName()}' has been created successfully`,
				action: action, detailedMessages: newVehicle});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleUpdateVehicle(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleService",
			method: "handleUpdateVehicle",
			message: `Update Vehicle '${req.body.model} ${req.body.manufacturer}' (ID '${req.body.id}')`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = VehicleSecurity.filterVehicleUpdateRequest( req.body, req.user );
		let vehicle;
		// Check email
		global.storage.getVehicle(filteredRequest.id).then((foundVehicle) => {
			vehicle = foundVehicle;
			if (!vehicle) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle with ID '${filteredRequest.id}' does not exist anymore`,
					550, "VehicleService", "handleUpdateVehicle");
			}
			// Check Mandatory fields
			Vehicles.checkIfVehicleValid(filteredRequest, req);
			// Check auth
			if (!CentralRestServerAuthorization.canUpdateVehicle(req.user, vehicle.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_UPDATE,
					CentralRestServerAuthorization.ENTITY_VEHICLE,
					vehicle.getID(),
					560, "VehicleService", "handleUpdateVehicle",
					req.user);
			}
			// Get the logged user
			return global.storage.getUser(req.user.id);
		// Logged User
		}).then((loggedUser) => {
			// Update
			Database.updateVehicle(filteredRequest, vehicle.getModel());
			// Update timestamp
			vehicle.setLastChangedBy(loggedUser);
			vehicle.setLastChangedOn(new Date());
			// Update Vehicle's Image
			if (filteredRequest.withVehicleImages) {
				return vehicle.saveImages();
			}
		}).then(() => {
			// Update Vehicle
			return vehicle.save();
		}).then((updatedVehicle) => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "VehicleService", method: "handleUpdateVehicle",
				message: `Vehicle '${updatedVehicle.getName()}' has been updated successfully`,
				action: action, detailedMessages: updatedVehicle});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = VehicleService;
