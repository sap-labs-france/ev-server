import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import VehicleManufacturerSecurity from './security/VehicleManufacturerSecurity';
import VehicleManufacturerStorage from '../../../storage/mongodb/VehicleManufacturerStorage';

export default class VehicleManufacturerService {

  public static async handleDeleteVehicleManufacturer(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const vehicleManufacturerID = VehicleManufacturerSecurity.filterVehicleManufacturerRequestByID(req.query);
    // Check Mandatory fields
    if (!vehicleManufacturerID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'The Vehicle Manufacturer\'s ID must be provided',
        module: 'VehicleManufacturerService',
        method: 'handleDeleteVehicleManufacturer',
        user: req.user
      });
    }
    // Check auth
    if (!Authorizations.canDeleteVehicleManufacturer(req.user)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_DELETE,
        entity: Constants.ENTITY_VEHICLE_MANUFACTURER,
        module: 'VehicleManufacturerService',
        method: 'handleDeleteVehicleManufacturer',
        value: vehicleManufacturerID
      });
    }
    // Get
    const vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, vehicleManufacturerID);
    if (!vehicleManufacturer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        message: `Vehicle Manufacturer with ID '${vehicleManufacturerID}' does not exist`,
        module: 'VehicleManufacturerService',
        method: 'handleDeleteVehicleManufacturer',
        user: req.user
      });
    }
    // Delete
    await VehicleManufacturerStorage.deleteVehicleManufacturer(req.user.tenantID, vehicleManufacturer.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'VehicleManufacturerService', method: 'handleDeleteVehicleManufacturer',
      message: `Vehicle Manufacturer '${vehicleManufacturer.name}' has been deleted successfully`,
      action: action, detailedMessages: vehicleManufacturer });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetVehicleManufacturer(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerRequest(req.query);
    // Charge Box is mandatory
    if (!filteredRequest.ID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'The Vehicle Manufacturer\'s ID must be provided',
        module: 'VehicleManufacturerService',
        method: 'handleGetVehicleManufacturer',
        user: req.user
      });
    }
    // Check auth
    if (!Authorizations.canReadVehicle(req.user)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_READ,
        entity: Constants.ENTITY_VEHICLE_MANUFACTURER,
        module: 'VehicleManufacturerService',
        method: 'handleGetVehicleManufacturer',
        value: filteredRequest.ID
      });
    }
    // Get it
    const vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, filteredRequest.ID);
    if (!vehicleManufacturer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The Vehicle Manufacturer with ID '${filteredRequest.ID}' does not exist anymore`,
        module: 'VehicleManufacturerService',
        method: 'handleGetVehicleManufacturer',
        user: req.user
      });
    }
    // Return
    res.json(
      // Filter
      VehicleManufacturerSecurity.filterVehicleManufacturerResponse(
        vehicleManufacturer, req.user)
    );
    next();
  }

  public static async handleGetVehicleManufacturers(action: string, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListVehicleManufacturers(req.user)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_LIST,
        entity: Constants.ENTITY_VEHICLE_MANUFACTURERS,
        module: 'VehicleManufacturerService',
        method: 'handleGetVehicleManufacturer'
      });
    }
    // Filter
    const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturersRequest(req.query);
    // Get the vehicle Manufacturers
    const vehicleManufacturers = await VehicleManufacturerStorage.getVehicleManufacturers(req.user.tenantID,
      { 'search': filteredRequest.Search, 'withVehicles': filteredRequest.WithVehicles,
        'vehicleType': filteredRequest.VehicleType },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
    // Filter
    VehicleManufacturerSecurity.filterVehicleManufacturersResponse(vehicleManufacturers, req.user);
    // Return
    res.json(vehicleManufacturers);
    next();
  }

  public static async handleCreateVehicleManufacturer(action: string, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canCreateVehicleManufacturer(req.user)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_CREATE,
        entity: Constants.ENTITY_VEHICLE_MANUFACTURER,
        module: 'VehicleManufacturerService',
        method: 'handleCreateVehicleManufacturer'
      });
    }
    // Filter
    const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerCreateRequest(req.body);
    // Check Mandatory fields
    Utils.checkIfVehicleManufacturerValid(filteredRequest, req);
    // Create vehicleManufacturer
    const usr = { id: req.user.id };
    const date = new Date();
    const vehicleManufacturer = {
      ...filteredRequest,
      createdBy: usr,
      createdOn: date,
      lastChangedBy: usr,
      lastChangedOn: date
    };
    // Save
    vehicleManufacturer.id = await VehicleManufacturerStorage.saveVehicleManufacturer(req.user.tenantID, vehicleManufacturer);
    // Save
    if (vehicleManufacturer.logo) {
      await VehicleManufacturerStorage.saveVehicleManufacturerLogo(req.user.tenantID,
        vehicleManufacturer.id, vehicleManufacturer.logo);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'VehicleManufacturerService', method: 'handleCreateVehicleManufacturer',
      message: `Vehicle Manufacturer '${vehicleManufacturer.name}' has been created successfully`,
      action: action, detailedMessages: vehicleManufacturer });
    // Ok
    res.json(Object.assign({ id: vehicleManufacturer.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateVehicleManufacturer(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerUpdateRequest(req.body);
    // Check auth
    if (!Authorizations.canUpdateVehicleManufacturer(req.user)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_UPDATE,
        entity: Constants.ENTITY_VEHICLE_MANUFACTURER,
        module: 'VehicleManufacturerService',
        method: 'handleUpdateVehicleManufacturer',
        value: filteredRequest.id
      });
    }
    // Get
    let vehicleManufacturer = await	VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, filteredRequest.id);
    if (!vehicleManufacturer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The Vehicle Manufacturer with ID '${filteredRequest.id}' does not exist anymore`,
        module: 'VehicleManufacturerService',
        method: 'handleUpdateVehicleManufacturer',
        user: req.user
      });
    }
    // Check
    Utils.checkIfVehicleManufacturerValid(filteredRequest, req);
    // Update
    vehicleManufacturer = { ...vehicleManufacturer, ...filteredRequest };
    // Update timestamp
    vehicleManufacturer.lastChangedBy = { 'id': req.user.id };
    vehicleManufacturer.lastChangedOn = new Date();
    // Update VehicleManufacturer
    await VehicleManufacturerStorage.saveVehicleManufacturer(req.user.tenantID, vehicleManufacturer);
    // Update VehicleManufacturer's Logo
    if (vehicleManufacturer.logo) {
      await VehicleManufacturerStorage.saveVehicleManufacturerLogo(req.user.tenantID,
        vehicleManufacturer.id, vehicleManufacturer.logo);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'VehicleManufacturerService', method: 'handleUpdateVehicleManufacturer',
      message: `Vehicle Manufacturer '${vehicleManufacturer.name}' has been updated successfully`,
      action: action, detailedMessages: vehicleManufacturer });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetVehicleManufacturerLogo(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const vehicleManufacturerID = VehicleManufacturerSecurity.filterVehicleManufacturerRequestByID(req.query);
    // Charge Box is mandatory
    if (!vehicleManufacturerID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: 'The Vehicle Manufacturer\'s ID must be provided',
        module: 'VehicleManufacturerService',
        method: 'handleGetVehicleManufacturerLogo',
        user: req.user
      });
    }
    // Check auth
    if (!Authorizations.canReadVehicleManufacturer(req.user)) {
      throw new AppAuthError({
        errorCode: Constants.HTTP_AUTH_ERROR,
        user: req.user,
        action: Constants.ACTION_READ,
        entity: Constants.ENTITY_VEHICLE_MANUFACTURER,
        module: 'VehicleManufacturerService',
        method: 'handleGetVehicleManufacturerLogo',
        value: vehicleManufacturerID
      });
    }
    // Get it
    const vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, vehicleManufacturerID);
    if (!vehicleManufacturer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The Vehicle Manufacturer with ID '${vehicleManufacturerID}' does not exist anymore`,
        module: 'VehicleManufacturerService',
        method: 'handleGetVehicleManufacturerLogo',
        user: req.user
      });
    }
    // Get the logo
    const vehicleManufacturerLogo = await VehicleManufacturerStorage.getVehicleManufacturerLogo(req.user.tenantID, vehicleManufacturerID);
    // Return
    res.json(vehicleManufacturerLogo);
    next();
  }
}
