import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import VehicleSecurity from './security/VehicleSecurity';
import VehicleStorage from '../../../storage/mongodb/VehicleStorage';

export default class VehicleService {

  public static async handleDeleteVehicle(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const vehicleID = VehicleSecurity.filterVehicleRequestByID(req.query);
    // Check Mandatory fields
    if (!vehicleID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Vehicle\'s ID must be provided',
        module: 'VehicleService',
        method: 'handleDeleteVehicle',
        user: req.user
      });
    }
    // Check auth
    if (!Authorizations.canDeleteVehicle(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE,
        entity: Entity.VEHICLE,
        module: 'VehicleService',
        method: 'handleDeleteVehicle',
        value: vehicleID
      });
    }
    // Get
    const vehicle = await VehicleStorage.getVehicle(req.user.tenantID, vehicleID);
    if (!vehicle) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `Vehicle with ID '${vehicleID}' does not exist`,
        module: 'VehicleService',
        method: 'handleDeleteVehicle',
        user: req.user
      });
    }
    // Delete
    await VehicleStorage.deleteVehicle(req.user.tenantID, vehicleID);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'VehicleService', method: 'handleDeleteVehicle',
      message: `Vehicle '${vehicle.model}' has been deleted successfully`,
      action: action, detailedMessages: vehicle });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetVehicle(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = VehicleSecurity.filterVehicleRequest(req.query);
    // Charge Box is mandatory
    if (!filteredRequest.ID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Vehicle\'s ID must be provided',
        module: 'VehicleService',
        method: 'handleGetVehicle',
        user: req.user
      });
    }
    // Check auth
    if (!Authorizations.canReadVehicle(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.VEHICLE,
        module: 'VehicleService',
        method: 'handleGetVehicle',
        value: filteredRequest.ID
      });
    }
    // Get it
    const vehicle = await VehicleStorage.getVehicle(req.user.tenantID, filteredRequest.ID);
    if (!vehicle) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The Vehicle with ID '${filteredRequest.ID}' does not exist anymore`,
        module: 'VehicleService',
        method: 'handleGetVehicle',
        user: req.user
      });
    }
    // Return
    res.json(
      // Filter
      VehicleSecurity.filterVehicleResponse(
        vehicle, req.user)
    );
    next();
  }

  public static async handleGetVehicles(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListVehicles(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.VEHICLES,
        module: 'VehicleService',
        method: 'handleGetVehicles'
      });
    }
    // Filter
    const filteredRequest = VehicleSecurity.filterVehiclesRequest(req.query);
    // Get the vehicles
    const vehicles = await VehicleStorage.getVehicles(req.user.tenantID,
      { 'search': filteredRequest.Search, 'vehicleType': filteredRequest.Type,
        'vehicleManufacturerID': filteredRequest.VehicleManufacturerID },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
    // Filter
    vehicles.result = VehicleSecurity.filterVehiclesResponse(vehicles, req.user);
    // Return
    res.json(vehicles);
    next();
  }

  public static async handleGetVehicleImage(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const vehicleID = VehicleSecurity.filterVehicleRequestByID(req.query);
    // Charge Box is mandatory
    if (!vehicleID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'The Vehicle\'s ID must be provided',
        module: 'VehicleService',
        method: 'handleGetVehicleImage',
        user: req.user
      });
    }
    // Check auth
    if (!Authorizations.canReadVehicle(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.VEHICLE,
        module: 'VehicleService',
        method: 'handleGetVehicleImage',
        value: vehicleID
      });
    }
    // Get it
    const vehicle = await VehicleStorage.getVehicle(req.user.tenantID, vehicleID);
    if (!vehicle) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The Vehicle with ID '${vehicleID}' does not exist anymore`,
        module: 'VehicleService',
        method: 'handleGetVehicleImage',
        user: req.user
      });
    }
    // Get the image
    const vehicleImage = await VehicleStorage.getVehicleImage(req.user.tenantID, vehicleID);
    // Return
    res.json(vehicleImage);
    next();
  }

  public static async handleCreateVehicle(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canCreateVehicle(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ,
        entity: Entity.VEHICLE,
        module: 'VehicleService',
        method: 'handleCreateVehicle'
      });
    }
    // Filter
    const filteredRequest = VehicleSecurity.filterVehicleCreateRequest(req.body);
    // Check Mandatory fields
    Utils.checkIfVehicleValid(filteredRequest, req);
    // Create vehicle
    const usr = { id: req.user.id };
    const date = new Date();
    const vehicle = {
      ...filteredRequest,
      createdBy: usr,
      createdOn: date,
      lastChangedBy: usr,
      lastChangedOn: date
    };
    // Save
    vehicle.id = await VehicleStorage.saveVehicle(req.user.tenantID, vehicle);
    // Save
    if (vehicle.images) {
      await VehicleStorage.saveVehicleImages(req.user.tenantID, vehicle.id, vehicle.images);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'VehicleService', method: 'handleCreateVehicle',
      message: `Vehicle '${vehicle.model}' has been created successfully`,
      action: action, detailedMessages: vehicle });
    // Ok
    res.json(Object.assign({ id: vehicle.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateVehicle(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = VehicleSecurity.filterVehicleUpdateRequest(req.body);
    // Check Mandatory fields
    Utils.checkIfVehicleValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canUpdateVehicle(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE,
        entity: Entity.VEHICLE,
        module: 'VehicleService',
        method: 'handleUpdateVehicle',
        value: filteredRequest.id
      });
    }
    // Get
    let vehicle = await VehicleStorage.getVehicle(req.user.tenantID, filteredRequest.id);
    if (!vehicle) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `The Vehicle with ID '${filteredRequest.id}' does not exist anymore`,
        module: 'VehicleService',
        method: 'handleUpdateVehicle',
        user: req.user
      });
    }
    // Update
    vehicle = { ...vehicle, ...filteredRequest };
    // Update timestamp
    vehicle.lastChangedBy = { 'id': req.user.id };
    vehicle.lastChangedOn = new Date();
    // Update Vehicle
    await VehicleStorage.saveVehicle(req.user.tenantID, vehicle);
    // Update Vehicle's Image
    if (vehicle.images) {
      await VehicleStorage.saveVehicleImages(req.user.tenantID, vehicle.id, vehicle.images);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'VehicleService', method: 'handleUpdateVehicle',
      message: `Vehicle '${vehicle.model}' has been updated successfully`,
      action: action, detailedMessages: vehicle });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
