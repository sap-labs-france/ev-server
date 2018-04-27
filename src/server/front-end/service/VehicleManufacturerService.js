const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const VehicleManufacturers = require('../../../utils/VehicleManufacturers');
const Constants = require('../../../utils/Constants');
const Utils = require('../../../utils/Utils');
const VehicleManufacturer = require('../../../model/VehicleManufacturer');
const VehicleManufacturerSecurity = require('./security/VehicleManufacturerSecurity');

class VehicleManufacturerService {
	static handleDeleteVehicleManufacturer(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleManufacturerService",
			method: "handleDeleteVehicleManufacturer",
			message: `Delete Vehicle Manufacturer '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let vehicleManufacturer;
		let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerDeleteRequest(
			req.query, req.user);
		// Check Mandatory fields
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Vehicle Manufacturer's ID must be provided`), req, res, next);
			return;
		}
		// Get
		global.storage.getVehicleManufacturer(filteredRequest.ID).then((foundVehicleManufacturer) => {
			vehicleManufacturer = foundVehicleManufacturer;
			// Found?
			if (!vehicleManufacturer) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Vehicle Manufacturer with ID '${filteredRequest.ID}' does not exist`,
					550, "VehicleManufacturerService", "handleDeleteVehicleManufacturer");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteVehicleManufacturer(req.user, vehicleManufacturer.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.ENTITY_VEHICLE_MANUFACTURERS,
					vehicleManufacturer.getID(),
					560, "VehicleManufacturerService", "handleDeleteVehicleManufacturer",
					req.user);
			}
			// Delete
			return vehicleManufacturer.delete();
		}).then(() => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "VehicleManufacturerService", method: "handleDeleteVehicleManufacturer",
				message: `Vehicle Manufacturer '${vehicleManufacturer.getName()}' has been deleted successfully`,
				action: action, detailedMessages: vehicleManufacturer});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetVehicleManufacturer(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleManufacturerService",
			method: "handleGetVehicleManufacturer",
			message: `Read Vehicle Manufacturer '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Vehicle Manufacturer ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getVehicleManufacturer(filteredRequest.ID).then((vehicleManufacturer) => {
			if (!vehicleManufacturer) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle Manufacturer with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "VehicleManufacturerService", "handleGetVehicleManufacturer");
			}
			// Return
			res.json(
				// Filter
				VehicleManufacturerSecurity.filterVehicleManufacturerResponse(
					vehicleManufacturer.getModel(), req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetVehicleManufacturers(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleManufacturerService",
			method: "handleGetVehicleManufacturers",
			message: `Read All Vehicle Manufacturers`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListVehicleManufacturers(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_VEHICLE_MANUFACTURERSS,
				null,
				560, "VehicleManufacturerService", "handleGetVehicleManufacturers",
				req.user);
		}
		// Filter
		let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturersRequest(req.query, req.user);
		// Get the vehicle Manufacturers
		global.storage.getVehicleManufacturers(filteredRequest.Search, Constants.NO_LIMIT).then((vehicleManufacturers) => {
			let vehicleManufacturersJSon = [];
			vehicleManufacturers.forEach((vehicleManufacturer) => {
				// Set the model
				vehicleManufacturersJSon.push(vehicleManufacturer.getModel());
			});
			// Return
			res.json(
				// Filter
				VehicleManufacturerSecurity.filterVehicleManufacturersResponse(
					vehicleManufacturersJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleCreateVehicleManufacturer(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleManufacturerService",
			method: "handleCreateVehicleManufacturer",
			message: `Create Vehicle Manufacturer '${req.body.manufacturer} ${req.body.model}'`,
			detailedMessages: req.body
		});
		// Check auth
		if (!CentralRestServerAuthorization.canCreateVehicleManufacturer(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_CREATE,
				CentralRestServerAuthorization.ENTITY_VEHICLE_MANUFACTURERS,
				null,
				560, "VehicleManufacturerService", "handleCreateVehicleManufacturer",
				req.user);
		}
		// Filter
		let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerCreateRequest( req.body, req.user );
		// Check Mandatory fields
		if (VehicleManufacturers.checkIfVehicleManufacturerValid(action, filteredRequest, req, res, next)) {
			let vehicleManufacturer, newVehicleManufacturer;
			// Get the logged user
			global.storage.getUser(req.user.id).then((loggedUser) => {
				// Create vehicleManufacturer
				vehicleManufacturer = new VehicleManufacturer(filteredRequest);
				// Update timestamp
				vehicleManufacturer.setCreatedBy(loggedUser);
				vehicleManufacturer.setCreatedOn(new Date());
				// Save
				return vehicleManufacturer.save();
			}).then((createdVehicleManufacturer) => {
				newVehicleManufacturer = createdVehicleManufacturer;
				// Update VehicleManufacturer's Logo
				newVehicleManufacturer.setLogo(vehicleManufacturer.getLogo());
				// Save
				return newVehicleManufacturer.saveLogo();
			}).then(() => {
				Logging.logSecurityInfo({
					user: req.user, module: "VehicleManufacturerService", method: "handleCreateVehicleManufacturer",
					message: `Vehicle Manufacturer '${newVehicleManufacturer.getName()}' has been created successfully`,
					action: action, detailedMessages: newVehicleManufacturer});
				// Ok
				res.json({status: `Success`});
				next();
			}).catch((err) => {
				// Log
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		}
	}

	static handleUpdateVehicleManufacturer(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleManufacturerService",
			method: "handleUpdateVehicleManufacturer",
			message: `Update Vehicle Manufacturer '${req.body.model} ${req.body.manufacturer}' (ID '${req.body.id}')`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerUpdateRequest( req.body, req.user );
		let vehicleManufacturer;
		// Check email
		global.storage.getVehicleManufacturer(filteredRequest.id).then((foundVehicleManufacturer) => {
			vehicleManufacturer = foundVehicleManufacturer;
			if (!vehicleManufacturer) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle Manufacturer with ID '${filteredRequest.id}' does not exist anymore`,
					550, "VehicleManufacturerService", "handleUpdateVehicleManufacturer");
			}
			// Check Mandatory fields
			if (!VehicleManufacturers.checkIfVehicleManufacturerValid(action, filteredRequest, req, res, next)) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle Manufacturer request is invalid`,
					500, "VehicleManufacturerService", "handleUpdateVehicleManufacturer");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canUpdateVehicleManufacturer(req.user, vehicleManufacturer.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_UPDATE,
					CentralRestServerAuthorization.ENTITY_VEHICLE_MANUFACTURERS,
					vehicleManufacturer.getID(),
					560, "VehicleManufacturerService", "handleUpdateVehicleManufacturer",
					req.user);
			}
			// Get the logged user
			return global.storage.getUser(req.user.id);
		// Logged User
		}).then((loggedUser) => {
			// Update
			Database.updateVehicleManufacturer(filteredRequest, vehicleManufacturer.getModel());
			// Update timestamp
			vehicleManufacturer.setLastChangedBy(loggedUser);
			vehicleManufacturer.setLastChangedOn(new Date());
		}).then(() => {
			// Update VehicleManufacturer's Logo
			return vehicleManufacturer.saveLogo();
		}).then(() => {
			// Update VehicleManufacturer
			return vehicleManufacturer.save();
		}).then((updatedVehicleManufacturer) => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "VehicleManufacturerService", method: "handleUpdateVehicleManufacturer",
				message: `Vehicle Manufacturer '${updatedVehicleManufacturer.getName()}' has been updated successfully`,
				action: action, detailedMessages: updatedVehicleManufacturer});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetVehicleManufacturerLogo(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleManufacturerService",
			method: "handleGetVehicleManufacturerLogo",
			message: `Read Vehicle Manufacturer Logo '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Vehicle Manufacturer ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		let vehicleManufacturer;
		global.storage.getVehicleManufacturer(filteredRequest.ID).then((foundVehicleManufacturer) => {
			vehicleManufacturer = foundVehicleManufacturer;
			if (!vehicleManufacturer) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle Manufacturer with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "VehicleManufacturerService", "handleGetVehicleManufacturerLogo");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadVehicleManufacturer(req.user, vehicleManufacturer.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_COMPANY,
					vehicleManufacturer.getID(),
					560, "VehicleManufacturerService", "handleGetVehicleManufacturerLogo",
					req.user);
			}
			// Get the logo
			return global.storage.getVehicleManufacturerLogo(filteredRequest.ID);
		}).then((vehicleManufacturerLogo) => {
			// Found?
			if (vehicleManufacturerLogo) {
				Logging.logSecurityInfo({
					user: req.user,
					action: action,
					module: "VehicleManufacturerService", method: "handleGetVehicleManufacturerLogo",
					message: 'Read Vehicle Manufacturer Logo'
				});
				// Set the user
				res.json(vehicleManufacturerLogo);
			} else {
				res.json(null);
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetVehicleManufacturerLogos(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "VehicleManufacturerService", method: "handleGetVehicleManufacturerLogos",
			message: `Read Vehicle Manufacturer Logos`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListCompanies(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_COMPANIES,
				null,
				560, "VehicleManufacturerService", "handleGetVehicleManufacturerLogos",
				req.user);
		}
		// Get the vehicle manufacturer logo
		global.storage.getVehicleManufacturerLogos().then((vehicleManufacturerLogos) => {
			Logging.logSecurityInfo({
				user: req.user,
				action: action,
				module: "VehicleManufacturerService", method: "handleGetVehicleManufacturerLogos",
				message: 'Read Vehicle Manufacturer Logos'
			});
			res.json(vehicleManufacturerLogos);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = VehicleManufacturerService;
