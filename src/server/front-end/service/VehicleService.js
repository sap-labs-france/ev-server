const User = require('../../../model/User');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Authorizations = require('../../../authorization/Authorizations');
const Vehicles = require('../../../utils/Vehicles');
const Constants = require('../../../utils/Constants');
const Vehicle = require('../../../model/Vehicle');
const VehicleSecurity = require('./security/VehicleSecurity');

class VehicleService {
	static async handleDeleteVehicle(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = VehicleSecurity.filterVehicleDeleteRequest(req.query, req.user);
			// Check Mandatory fields
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle's ID must be provided`, 500, 
					'VehicleService', 'handleDeleteVehicle', req.user);
			}
			// Get
			let vehicle = await global.storage.getVehicle(filteredRequest.ID);
			if (!vehicle) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Vehicle with ID '${filteredRequest.ID}' does not exist`, 550, 
					'VehicleService', 'handleDeleteVehicle', req.user);
			}
			// Check auth
			if (!Authorizations.canDeleteVehicle(req.user, vehicle.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_DELETE,
					Constants.ENTITY_VEHICLE,
					vehicle.getID(),
					560, 
					'VehicleService', 'handleDeleteVehicle',
					req.user);
			}
			// Delete
			await vehicle.delete();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'VehicleService', method: 'handleDeleteVehicle',
				message: `Vehicle '${vehicle.getName()}' has been deleted successfully`,
				action: action, detailedMessages: vehicle});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetVehicle(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = VehicleSecurity.filterVehicleRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle's ID must be provided`, 500, 
					'VehicleService', 'handleGetVehicle', req.user);
			}
			// Get it
			let vehicle = await global.storage.getVehicle(filteredRequest.ID);
			if (!vehicle) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle with ID '${filteredRequest.ID}' does not exist anymore`, 550, 
					'VehicleService', 'handleGetVehicle', req.user);
			}
			// Return
			res.json(
				// Filter
				VehicleSecurity.filterVehicleResponse(
					vehicle.getModel(), req.user)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetVehicles(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListVehicles(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_VEHICLES,
					null,
					560, 
					'VehicleService', 'handleGetVehicles',
					req.user);
			}
			// Filter
			let filteredRequest = VehicleSecurity.filterVehiclesRequest(req.query, req.user);
			// Get the vehicles
			let vehicles = await global.storage.getVehicles(
				filteredRequest.Search, null, filteredRequest.Type, Constants.NO_LIMIT);
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
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetVehicleImage(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = VehicleSecurity.filterVehicleRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle's ID must be provided`, 500, 
					'VehicleService', 'handleGetVehicleImage', req.user);
			}
			// Get it
			let vehicle = await global.storage.getVehicle(filteredRequest.ID);
			if (!vehicle) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle with ID '${filteredRequest.ID}' does not exist anymore`, 550, 
					'VehicleService', 'handleGetVehicleImage', req.user);
			}
			// Check auth
			if (!Authorizations.canReadVehicle(req.user, vehicle.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_VEHICLE,
					vehicle.getID(),
					560, 
					'VehicleService', 'handleGetVehicleImage',
					req.user);
			}
			// Get the image
			let vehicleImage = await global.storage.getVehicleImage(filteredRequest.ID);
			// Return
			res.json(vehicleImage);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetVehicleImages(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListVehicles(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_VEHICLES,
					null,
					560, 
					'VehicleService', 'handleGetVehicleImages',
					req.user);
			}
			// Get the vehicle image
			let vehicleImages = await global.storage.getVehicleImages();
			// Return
			res.json(vehicleImages);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleCreateVehicle(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canCreateVehicle(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_CREATE,
					Constants.ENTITY_VEHICLE,
					null,
					560, 
					'VehicleService', 'handleCreateVehicle',
					req.user);
			}
			// Filter
			let filteredRequest = VehicleSecurity.filterVehicleCreateRequest( req.body, req.user );
			// Check Mandatory fields
			Vehicles.checkIfVehicleValid(filteredRequest, req);
			// Create vehicle
			let vehicle = new Vehicle(filteredRequest);
			// Update timestamp
			vehicle.setCreatedBy(new User({'id': req.user.id}));
			vehicle.setCreatedOn(new Date());
			// Save
			let newVehicle = await vehicle.save();
			// Save Site's Image
			if (vehicle.getImages()) {
				newVehicle.setImages(vehicle.getImages());
			} else {
				newVehicle.setImages([]);
			}
			// Save
			await newVehicle.saveImages();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'VehicleService', method: 'handleCreateVehicle',
				message: `Vehicle '${newVehicle.getName()}' has been created successfully`,
				action: action, detailedMessages: newVehicle});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleUpdateVehicle(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = VehicleSecurity.filterVehicleUpdateRequest( req.body, req.user );
			// Check email
			let vehicle = await global.storage.getVehicle(filteredRequest.id);
			if (!vehicle) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Vehicle with ID '${filteredRequest.id}' does not exist anymore`, 550, 
					'VehicleService', 'handleUpdateVehicle', req.user);
			}
			// Check Mandatory fields
			Vehicles.checkIfVehicleValid(filteredRequest, req);
			// Check auth
			if (!Authorizations.canUpdateVehicle(req.user, vehicle.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE,
					Constants.ENTITY_VEHICLE,
					vehicle.getID(),
					560, 
					'VehicleService', 'handleUpdateVehicle',
					req.user);
			}
			// Update
			Database.updateVehicle(filteredRequest, vehicle.getModel());
			// Update timestamp
			vehicle.setLastChangedBy(new User({'id': req.user.id}));
			vehicle.setLastChangedOn(new Date());
			// Update Vehicle
			let updatedVehicle = await vehicle.save();
			// Update Vehicle's Image
			if (filteredRequest.withVehicleImages) {
				await vehicle.saveImages();
			}
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'VehicleService', method: 'handleUpdateVehicle',
				message: `Vehicle '${updatedVehicle.getName()}' has been updated successfully`,
				action: action, detailedMessages: updatedVehicle});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}
}

module.exports = VehicleService;
