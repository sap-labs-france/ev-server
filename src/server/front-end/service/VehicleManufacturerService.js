const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Authorizations = require('../../../authorization/Authorizations');
const VehicleManufacturers = require('../../../utils/VehicleManufacturers');
const Constants = require('../../../utils/Constants');
const Utils = require('../../../utils/Utils');
const VehicleManufacturer = require('../../../model/VehicleManufacturer');
const VehicleManufacturerSecurity = require('./security/VehicleManufacturerSecurity');

class VehicleManufacturerService {
	static handleDeleteVehicleManufacturer(action, req, res, next) {
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
			if (!Authorizations.canDeleteVehicleManufacturer(req.user, vehicleManufacturer.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_DELETE,
					Authorizations.ENTITY_VEHICLE_MANUFACTURERS,
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
		// Check auth
		if (!Authorizations.canListVehicleManufacturers(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_LIST,
				Authorizations.ENTITY_VEHICLE_MANUFACTURERSS,
				null,
				560, "VehicleManufacturerService", "handleGetVehicleManufacturers",
				req.user);
		}
		// Filter
		let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturersRequest(req.query, req.user);
		// Get the vehicle Manufacturers
		global.storage.getVehicleManufacturers(filteredRequest.Search,
				filteredRequest.WithVehicles, filteredRequest.VehicleType,
				Constants.NO_LIMIT).then((vehicleManufacturers) => {
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
		// Check auth
		if (!Authorizations.canCreateVehicleManufacturer(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_CREATE,
				Authorizations.ENTITY_VEHICLE_MANUFACTURERS,
				null,
				560, "VehicleManufacturerService", "handleCreateVehicleManufacturer",
				req.user);
		}
		// Filter
		let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerCreateRequest( req.body, req.user );
		let vehicleManufacturer, newVehicleManufacturer;
		// Get the logged user
		global.storage.getUser(req.user.id).then((loggedUser) => {
			// Check Mandatory fields
			VehicleManufacturers.checkIfVehicleManufacturerValid(filteredRequest, req);
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

	static handleUpdateVehicleManufacturer(action, req, res, next) {
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
			VehicleManufacturers.checkIfVehicleManufacturerValid(filteredRequest, req);
			// Check auth
			if (!Authorizations.canUpdateVehicleManufacturer(req.user, vehicleManufacturer.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE,
					Authorizations.ENTITY_VEHICLE_MANUFACTURERS,
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
			if (!Authorizations.canReadVehicleManufacturer(req.user, vehicleManufacturer.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Authorizations.ENTITY_COMPANY,
					vehicleManufacturer.getID(),
					560, "VehicleManufacturerService", "handleGetVehicleManufacturerLogo",
					req.user);
			}
			// Get the logo
			return global.storage.getVehicleManufacturerLogo(filteredRequest.ID);
		}).then((vehicleManufacturerLogo) => {
			// Found?
			if (vehicleManufacturerLogo) {
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
		// Check auth
		if (!Authorizations.canListCompanies(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_LIST,
				Authorizations.ENTITY_COMPANIES,
				null,
				560, "VehicleManufacturerService", "handleGetVehicleManufacturerLogos",
				req.user);
		}
		// Get the vehicle manufacturer logo
		global.storage.getVehicleManufacturerLogos().then((vehicleManufacturerLogos) => {
			res.json(vehicleManufacturerLogos);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = VehicleManufacturerService;
