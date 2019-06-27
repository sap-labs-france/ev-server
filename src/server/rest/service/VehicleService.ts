import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Database from '../../../utils/Database';
import Logging from '../../../utils/Logging';
import User from '../../../entity/User';
import Vehicle from '../../../entity/Vehicle';
import VehicleSecurity from './security/VehicleSecurity';

export default class VehicleService {
  static async handleDeleteVehicle(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = VehicleSecurity.filterVehicleDeleteRequest(req.query, req.user);
      // Check Mandatory fields
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Vehicle\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'VehicleService', 'handleDeleteVehicle', req.user);
      }
      // Get
      const vehicle = await Vehicle.getVehicle(req.user.tenantID, filteredRequest.ID);
      if (!vehicle) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Vehicle with ID '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'VehicleService', 'handleDeleteVehicle', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteVehicle(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_VEHICLE,
          vehicle.getID(),
          Constants.HTTP_AUTH_ERROR,
          'VehicleService', 'handleDeleteVehicle',
          req.user);
      }
      // Delete
      await vehicle.delete();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'VehicleService', method: 'handleDeleteVehicle',
        message: `Vehicle '${vehicle.getName()}' has been deleted successfully`,
        action: action, detailedMessages: vehicle });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetVehicle(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = VehicleSecurity.filterVehicleRequest(req.query, req.user);
      // Charge Box is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Vehicle\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'VehicleService', 'handleGetVehicle', req.user);
      }
      // Get it
      const vehicle = await Vehicle.getVehicle(req.user.tenantID, filteredRequest.ID);
      if (!vehicle) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Vehicle with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
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
          Constants.ACTION_LIST,
          Constants.ENTITY_VEHICLES,
          null,
          Constants.HTTP_AUTH_ERROR,
          'VehicleService', 'handleGetVehicles',
          req.user);
      }
      // Filter
      const filteredRequest = VehicleSecurity.filterVehiclesRequest(req.query, req.user);
      // Get the vehicles
      const vehicles = await Vehicle.getVehicles(req.user.tenantID,
        { 'search': filteredRequest.Search, 'vehicleType': filteredRequest.Type,
          'vehicleManufacturerID': filteredRequest.VehicleManufacturerID,
          'onlyRecordCount': filteredRequest.OnlyRecordCount },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      vehicles.result = vehicles.result.map((vehicle) => {
        return vehicle.getModel();
      });
      // Filter
      VehicleSecurity.filterVehiclesResponse(vehicles, req.user);
      // Return
      res.json(vehicles);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetVehicleImage(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = VehicleSecurity.filterVehicleRequest(req.query, req.user);
      // Charge Box is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Vehicle\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'VehicleService', 'handleGetVehicleImage', req.user);
      }
      // Get it
      const vehicle = await Vehicle.getVehicle(req.user.tenantID, filteredRequest.ID);
      if (!vehicle) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Vehicle with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'VehicleService', 'handleGetVehicleImage', req.user);
      }
      // Check auth
      if (!Authorizations.canReadVehicle(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_VEHICLE,
          vehicle.getID(),
          Constants.HTTP_AUTH_ERROR,
          'VehicleService', 'handleGetVehicleImage',
          req.user);
      }
      // Get the image
      const vehicleImage = await Vehicle.getVehicleImage(req.user.tenantID, filteredRequest.ID);
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
          Constants.ACTION_LIST,
          Constants.ENTITY_VEHICLES,
          null,
          Constants.HTTP_AUTH_ERROR,
          'VehicleService', 'handleGetVehicleImages',
          req.user);
      }
      // Get the vehicle image
      const vehicleImages = await Vehicle.getVehicleImages(req.user.tenantID);
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
          Constants.ACTION_CREATE,
          Constants.ENTITY_VEHICLE,
          null,
          Constants.HTTP_AUTH_ERROR,
          'VehicleService', 'handleCreateVehicle',
          req.user);
      }
      // Filter
      const filteredRequest = VehicleSecurity.filterVehicleCreateRequest(req.body, req.user);
      // Check Mandatory fields
      Vehicle.checkIfVehicleValid(filteredRequest, req);
      // Create vehicle
      const vehicle = new Vehicle(req.user.tenantID, filteredRequest);
      // Update timestamp
      vehicle.setCreatedBy(new User(req.user.tenantID, { 'id': req.user.id }));
      vehicle.setCreatedOn(new Date());
      // Save
      const newVehicle = await vehicle.save();
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
        tenantID: req.user.tenantID,
        user: req.user, module: 'VehicleService', method: 'handleCreateVehicle',
        message: `Vehicle '${newVehicle.getName()}' has been created successfully`,
        action: action, detailedMessages: newVehicle });
      // Ok
      res.json(Object.assign({ id: newVehicle.getID() }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleUpdateVehicle(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = VehicleSecurity.filterVehicleUpdateRequest(req.body, req.user);
      // Check email
      const vehicle = await Vehicle.getVehicle(req.user.tenantID, filteredRequest.id);
      if (!vehicle) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Vehicle with ID '${filteredRequest.id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'VehicleService', 'handleUpdateVehicle', req.user);
      }
      // Check Mandatory fields
      Vehicle.checkIfVehicleValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateVehicle(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_VEHICLE,
          vehicle.getID(),
          Constants.HTTP_AUTH_ERROR,
          'VehicleService', 'handleUpdateVehicle',
          req.user);
      }
      // Update
      Database.updateVehicle(filteredRequest, vehicle.getModel());
      // Update timestamp
      vehicle.setLastChangedBy(new User(req.user.tenantID, { 'id': req.user.id }));
      vehicle.setLastChangedOn(new Date());
      // Update Vehicle
      const updatedVehicle = await vehicle.save();
      // Update Vehicle's Image
      if (filteredRequest.withVehicleImages) {
        await vehicle.saveImages();
      }
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'VehicleService', method: 'handleUpdateVehicle',
        message: `Vehicle '${updatedVehicle.getName()}' has been updated successfully`,
        action: action, detailedMessages: updatedVehicle });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}
