const User = require('../../../model/User');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Authorizations = require('../../../authorization/Authorizations');
const Constants = require('../../../utils/Constants');
const VehicleManufacturer = require('../../../model/VehicleManufacturer');
const VehicleManufacturerSecurity = require('./security/VehicleManufacturerSecurity');
const VehicleManufacturerStorage = require('../../../storage/mongodb/VehicleManufacturerStorage'); 

class VehicleManufacturerService {
	static async handleDeleteVehicleManufacturer(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerDeleteRequest(
				req.query, req.user);
			// Check Mandatory fields
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle Manufacturer's ID must be provided`, 500, 
					'VehicleManufacturerService', 'handleDeleteVehicleManufacturer', req.user);
			}
			// Get
			let vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(filteredRequest.ID);
			if (!vehicleManufacturer) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Vehicle Manufacturer with ID '${filteredRequest.ID}' does not exist`, 550, 
					'VehicleManufacturerService', 'handleDeleteVehicleManufacturer', req.user);
			}
			// Check auth
			if (!Authorizations.canDeleteVehicleManufacturer(req.user, vehicleManufacturer.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_DELETE,
					Constants.ENTITY_VEHICLE_MANUFACTURERS,
					vehicleManufacturer.getID(),
					560, 
					'VehicleManufacturerService', 'handleDeleteVehicleManufacturer',
					req.user);
			}
			// Delete
			await vehicleManufacturer.delete();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'VehicleManufacturerService', method: 'handleDeleteVehicleManufacturer',
				message: `Vehicle Manufacturer '${vehicleManufacturer.getName()}' has been deleted successfully`,
				action: action, detailedMessages: vehicleManufacturer});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetVehicleManufacturer(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle Manufacturer's ID must be provided`, 500, 
					'VehicleManufacturerService', 'handleGetVehicleManufacturer', req.user);
			}
			// Get it
			let vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(filteredRequest.ID);
			if (!vehicleManufacturer) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle Manufacturer with ID '${filteredRequest.ID}' does not exist anymore`, 550, 
					'VehicleManufacturerService', 'handleGetVehicleManufacturer', req.user);
			}
			// Return
			res.json(
				// Filter
				VehicleManufacturerSecurity.filterVehicleManufacturerResponse(
					vehicleManufacturer.getModel(), req.user)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetVehicleManufacturers(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListVehicleManufacturers(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_VEHICLE_MANUFACTURERSS,
					null,
					560, 
					'VehicleManufacturerService', 'handleGetVehicleManufacturers',
					req.user);
			}
			// Filter
			let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturersRequest(req.query, req.user);
			// Get the vehicle Manufacturers
			let vehicleManufacturers = await VehicleManufacturerStorage.getVehicleManufacturers(
				{ 'search': filteredRequest.Search, 'withVehicles': filteredRequest.WithVehicles, 'vehicleType': filteredRequest.VehicleType}, 
				filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
			// Set
			vehicleManufacturers.result = vehicleManufacturers.result.map((vehicleManufacturer) => vehicleManufacturer.getModel());
			// Filter
			vehicleManufacturers.result = VehicleManufacturerSecurity.filterVehicleManufacturersResponse(
				vehicleManufacturers.result, req.user);
			// Return
			res.json(vehicleManufacturers);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleCreateVehicleManufacturer(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canCreateVehicleManufacturer(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_CREATE,
					Constants.ENTITY_VEHICLE_MANUFACTURERS,
					null,
					560, 
					'VehicleManufacturerService', 'handleCreateVehicleManufacturer',
					req.user);
			}
			// Filter
			let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerCreateRequest( req.body, req.user );
			// Check Mandatory fields
			VehicleManufacturer.checkIfVehicleManufacturerValid(filteredRequest, req);
			// Create vehicleManufacturer
			let vehicleManufacturer = new VehicleManufacturer(filteredRequest);
			// Update timestamp
			vehicleManufacturer.setCreatedBy(new User({'id': req.user.id}));
			vehicleManufacturer.setCreatedOn(new Date());
			// Save
			let newVehicleManufacturer = await vehicleManufacturer.save();
			// Update VehicleManufacturer's Logo
			newVehicleManufacturer.setLogo(vehicleManufacturer.getLogo());
			// Save
			await newVehicleManufacturer.saveLogo();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'VehicleManufacturerService', method: 'handleCreateVehicleManufacturer',
				message: `Vehicle Manufacturer '${newVehicleManufacturer.getName()}' has been created successfully`,
				action: action, detailedMessages: newVehicleManufacturer});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleUpdateVehicleManufacturer(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerUpdateRequest( req.body, req.user );
			// Check email
			let vehicleManufacturer = await	VehicleManufacturerStorage.getVehicleManufacturer(filteredRequest.id);
			if (!vehicleManufacturer) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle Manufacturer with ID '${filteredRequest.id}' does not exist anymore`, 550, 
					'VehicleManufacturerService', 'handleUpdateVehicleManufacturer', req.user);
			}
			// Check Mandatory fields
			VehicleManufacturer.checkIfVehicleManufacturerValid(filteredRequest, req);
			// Check auth
			if (!Authorizations.canUpdateVehicleManufacturer(req.user, vehicleManufacturer.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE,
					Constants.ENTITY_VEHICLE_MANUFACTURERS,
					vehicleManufacturer.getID(),
					560, 
					'VehicleManufacturerService', 'handleUpdateVehicleManufacturer',
					req.user);
			}
			// Update
			Database.updateVehicleManufacturer(filteredRequest, vehicleManufacturer.getModel());
			// Update timestamp
			vehicleManufacturer.setLastChangedBy(new User({'id': req.user.id}));
			vehicleManufacturer.setLastChangedOn(new Date());
			// Update VehicleManufacturer
			let updatedVehicleManufacturer = await vehicleManufacturer.save();
			// Update VehicleManufacturer's Logo
			await vehicleManufacturer.saveLogo();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'VehicleManufacturerService', method: 'handleUpdateVehicleManufacturer',
				message: `Vehicle Manufacturer '${updatedVehicleManufacturer.getName()}' has been updated successfully`,
				action: action, detailedMessages: updatedVehicleManufacturer});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetVehicleManufacturerLogo(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle Manufacturer's ID must be provided`, 500, 
					'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo', req.user);
			}
			// Get it
			let vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(filteredRequest.ID);
			if (!vehicleManufacturer) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle Manufacturer with ID '${filteredRequest.ID}' does not exist anymore`, 550, 
					'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo', req.user);
			}
			// Check auth
			if (!Authorizations.canReadVehicleManufacturer(req.user, vehicleManufacturer.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_COMPANY,
					vehicleManufacturer.getID(),
					560, 
					'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo',
					req.user);
			}
			// Get the logo
			let vehicleManufacturerLogo = await VehicleManufacturerStorage.getVehicleManufacturerLogo(filteredRequest.ID);
			// Return
			res.json(vehicleManufacturerLogo);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetVehicleManufacturerLogos(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListCompanies(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_COMPANIES,
					null,
					560, 
					'VehicleManufacturerService', 'handleGetVehicleManufacturerLogos',
					req.user);
			}
			// Get the vehicle manufacturer logo
			let vehicleManufacturerLogos = await VehicleManufacturerStorage.getVehicleManufacturerLogos();
			// Return
			res.json(vehicleManufacturerLogos);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}
}

module.exports = VehicleManufacturerService;
