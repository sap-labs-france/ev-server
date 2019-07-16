import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Database from '../../../utils/Database';
import Logging from '../../../utils/Logging';
import User from '../../../types/User';
import VehicleManufacturer from '../../../entity/VehicleManufacturer';
import VehicleManufacturerSecurity from './security/VehicleManufacturerSecurity';

export default class VehicleManufacturerService {
  static async handleDeleteVehicleManufacturer(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerDeleteRequest(
        req.query, req.user);
      // Check Mandatory fields
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Vehicle Manufacturer\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'VehicleManufacturerService', 'handleDeleteVehicleManufacturer', req.user);
      }
      // Get
      const vehicleManufacturer = await VehicleManufacturer.getVehicleManufacturer(req.user.tenantID, filteredRequest.ID);
      if (!vehicleManufacturer) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Vehicle Manufacturer with ID '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'VehicleManufacturerService', 'handleDeleteVehicleManufacturer', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteVehicleManufacturer(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_VEHICLE_MANUFACTURERS,
          vehicleManufacturer.getID(),
          Constants.HTTP_AUTH_ERROR,
          'VehicleManufacturerService', 'handleDeleteVehicleManufacturer',
          req.user);
      }
      // Delete
      await vehicleManufacturer.delete();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'VehicleManufacturerService', method: 'handleDeleteVehicleManufacturer',
        message: `Vehicle Manufacturer '${vehicleManufacturer.getName()}' has been deleted successfully`,
        action: action, detailedMessages: vehicleManufacturer });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetVehicleManufacturer(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerRequest(req.query, req.user);
      // Charge Box is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Vehicle Manufacturer\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'VehicleManufacturerService', 'handleGetVehicleManufacturer', req.user);
      }
      // Get it
      const vehicleManufacturer = await VehicleManufacturer.getVehicleManufacturer(req.user.tenantID, filteredRequest.ID);
      if (!vehicleManufacturer) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Vehicle Manufacturer with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
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
          Constants.ACTION_LIST,
          Constants.ENTITY_VEHICLE_MANUFACTURERS,
          null,
          Constants.HTTP_AUTH_ERROR,
          'VehicleManufacturerService', 'handleGetVehicleManufacturers',
          req.user);
      }
      // Filter
      const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturersRequest(req.query, req.user);
      // Get the vehicle Manufacturers
      const vehicleManufacturers = await VehicleManufacturer.getVehicleManufacturers(req.user.tenantID,
        { 'search': filteredRequest.Search, 'withVehicles': filteredRequest.WithVehicles,
          'vehicleType': filteredRequest.VehicleType },
        { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
      // Set
      vehicleManufacturers.result = vehicleManufacturers.result.map((vehicleManufacturer) => {
        return vehicleManufacturer.getModel();
      });
      // Filter
      VehicleManufacturerSecurity.filterVehicleManufacturersResponse(vehicleManufacturers, req.user);
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
          Constants.ACTION_CREATE,
          Constants.ENTITY_VEHICLE_MANUFACTURERS,
          null,
          Constants.HTTP_AUTH_ERROR,
          'VehicleManufacturerService', 'handleCreateVehicleManufacturer',
          req.user);
      }
      // Filter
      const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerCreateRequest(req.body, req.user);
      // Check Mandatory fields
      VehicleManufacturer.checkIfVehicleManufacturerValid(filteredRequest, req);
      // Create vehicleManufacturer
      const vehicleManufacturer = new VehicleManufacturer(req.user.tenantID, filteredRequest);
      // Update timestamp
      vehicleManufacturer.setCreatedBy({ 'id': req.user.id });
      vehicleManufacturer.setCreatedOn(new Date());
      // Save
      const newVehicleManufacturer = await vehicleManufacturer.save();
      // Update VehicleManufacturer's Logo
      newVehicleManufacturer.setLogo(vehicleManufacturer.getLogo());
      // Save
      await newVehicleManufacturer.saveLogo();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'VehicleManufacturerService', method: 'handleCreateVehicleManufacturer',
        message: `Vehicle Manufacturer '${newVehicleManufacturer.getName()}' has been created successfully`,
        action: action, detailedMessages: newVehicleManufacturer });
      // Ok
      res.json(Object.assign({ id: newVehicleManufacturer.getID() }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleUpdateVehicleManufacturer(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerUpdateRequest(req.body, req.user);
      // Check email
      const vehicleManufacturer = await	VehicleManufacturer.getVehicleManufacturer(req.user.tenantID, filteredRequest.id);
      if (!vehicleManufacturer) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Vehicle Manufacturer with ID '${filteredRequest.id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'VehicleManufacturerService', 'handleUpdateVehicleManufacturer', req.user);
      }
      // Check Mandatory fields
      VehicleManufacturer.checkIfVehicleManufacturerValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateVehicleManufacturer(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_VEHICLE_MANUFACTURERS,
          vehicleManufacturer.getID(),
          Constants.HTTP_AUTH_ERROR,
          'VehicleManufacturerService', 'handleUpdateVehicleManufacturer',
          req.user);
      }
      // Update
      Database.updateVehicleManufacturer(filteredRequest, vehicleManufacturer.getModel());
      // Update timestamp
      vehicleManufacturer.setLastChangedBy({ 'id': req.user.id });
      vehicleManufacturer.setLastChangedOn(new Date());
      // Update VehicleManufacturer
      const updatedVehicleManufacturer = await vehicleManufacturer.save();
      // Update VehicleManufacturer's Logo
      await vehicleManufacturer.saveLogo();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'VehicleManufacturerService', method: 'handleUpdateVehicleManufacturer',
        message: `Vehicle Manufacturer '${updatedVehicleManufacturer.getName()}' has been updated successfully`,
        action: action, detailedMessages: updatedVehicleManufacturer });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetVehicleManufacturerLogo(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerRequest(req.query, req.user);
      // Charge Box is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Vehicle Manufacturer\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo', req.user);
      }
      // Get it
      const vehicleManufacturer = await VehicleManufacturer.getVehicleManufacturer(req.user.tenantID, filteredRequest.ID);
      if (!vehicleManufacturer) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Vehicle Manufacturer with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo', req.user);
      }
      // Check auth
      if (!Authorizations.canReadVehicleManufacturer(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_COMPANY,
          vehicleManufacturer.getID(),
          Constants.HTTP_AUTH_ERROR,
          'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo',
          req.user);
      }
      // Get the logo
      const vehicleManufacturerLogo = await VehicleManufacturer.getVehicleManufacturerLogo(req.user.tenantID, filteredRequest.ID);
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
          Constants.ACTION_LIST,
          Constants.ENTITY_COMPANIES,
          null,
          Constants.HTTP_AUTH_ERROR,
          'VehicleManufacturerService', 'handleGetVehicleManufacturerLogos',
          req.user);
      }
      // Get the vehicle manufacturer logo
      const vehicleManufacturerLogos = await VehicleManufacturer.getVehicleManufacturerLogos(req.user.tenantID);
      // Return
      res.json(vehicleManufacturerLogos);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}
