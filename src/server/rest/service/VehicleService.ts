import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Database from '../../../utils/Database';
import Logging from '../../../utils/Logging';
import User from '../../../types/User';
import Utils from '../../../utils/Utils';
import Vehicle from '../../../types/Vehicle';
import VehicleSecurity from './security/VehicleSecurity';
import VehicleStorage from '../../../storage/mongodb/VehicleStorage';

export default class VehicleService {

  public static async handleDeleteVehicle(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const ID = VehicleSecurity.filterVehicleRequest(req.query);
    // Check Mandatory fields
    if (!ID) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Vehicle\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'VehicleService', 'handleDeleteVehicle', req.user);
    }
    // Get
    const vehicle = await VehicleStorage.getVehicle(req.user.tenantID, ID);
    if (!vehicle) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle with ID '${ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'VehicleService', 'handleDeleteVehicle', req.user);
    }
    // Check auth
    if (!Authorizations.canDeleteVehicle(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_VEHICLE,
        vehicle.id,
        Constants.HTTP_AUTH_ERROR,
        'VehicleService', 'handleDeleteVehicle',
        req.user);
    }
    // Delete
    await VehicleStorage.deleteVehicle(req.user.tenantID, ID);
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
    const ID = VehicleSecurity.filterVehicleRequest(req.query);
    // Charge Box is mandatory
    if (!ID) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Vehicle\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'VehicleService', 'handleGetVehicle', req.user);
    }
    // Get it
    const vehicle = await VehicleStorage.getVehicle(req.user.tenantID, ID);
    if (!vehicle) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Vehicle with ID '${ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'VehicleService', 'handleGetVehicle', req.user);
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
    const ID = VehicleSecurity.filterVehicleRequest(req.query);
    // Charge Box is mandatory
    if (!ID) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Vehicle\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'VehicleService', 'handleGetVehicleImage', req.user);
    }
    // Get it
    const vehicle = await VehicleStorage.getVehicle(req.user.tenantID, ID);
    if (!vehicle) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Vehicle with ID '${ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'VehicleService', 'handleGetVehicleImage', req.user);
    }
    // Check auth
    if (!Authorizations.canReadVehicle(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_VEHICLE,
        vehicle.id,
        Constants.HTTP_AUTH_ERROR,
        'VehicleService', 'handleGetVehicleImage',
        req.user);
    }
    // Get the image
    const vehicleImage = await VehicleStorage.getVehicleImage(req.user.tenantID, ID);
    // Return
    res.json(vehicleImage);
    next();
  }

  public static async handleGetVehicleImages(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
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
    const vehicleImages = await VehicleStorage.getVehicleImages(req.user.tenantID, {},
      { limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0 });
    // Return
    res.json(vehicleImages);
    next();
  }

  public static async handleCreateVehicle(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
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
    const filteredRequest = VehicleSecurity.filterVehicleCreateRequest(req.body);
    // Check Mandatory fields
    VehicleService._checkIfVehicleValid(filteredRequest, req);
    // Create vehicle
    const vehicle = filteredRequest;
    // Update timestamp
    vehicle.createdBy = { 'id': req.user.id };
    vehicle.createdOn = new Date();
    vehicle.lastChangedBy = vehicle.createdBy;
    vehicle.lastChangedOn = vehicle.createdOn;
    // Save
    const newVehicleId = await VehicleStorage.saveVehicle(req.user.tenantID, vehicle);
    // Save
    if (vehicle.images) {
      await VehicleStorage.saveVehicleImages(req.user.tenantID, { id: newVehicleId, images: vehicle.images });
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'VehicleService', method: 'handleCreateVehicle',
      message: `Vehicle '${vehicle.model}' has been created successfully`,
      action: action, detailedMessages: vehicle });
    // Ok
    res.json(Object.assign({ id: newVehicleId }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateVehicle(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = VehicleSecurity.filterVehicleUpdateRequest(req.body);
    // Check email
    const vehicle = await VehicleStorage.getVehicle(req.user.tenantID, filteredRequest.id);
    if (!vehicle) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Vehicle with ID '${filteredRequest.id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'VehicleService', 'handleUpdateVehicle', req.user);
    }
    // Check Mandatory fields
    VehicleService._checkIfVehicleValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canUpdateVehicle(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_VEHICLE,
        vehicle.id,
        Constants.HTTP_AUTH_ERROR,
        'VehicleService', 'handleUpdateVehicle',
        req.user);
    }
    // Update
    const wImgs = filteredRequest.withVehicleImages;
    delete filteredRequest.withVehicleImages;
    const vehicleToSave = { ...vehicle, ...filteredRequest };
    // Update timestamp
    vehicleToSave.lastChangedBy = { 'id': req.user.id };
    vehicle.lastChangedOn = new Date();
    // Update Vehicle
    const updatedVehicle = await VehicleStorage.saveVehicle(req.user.tenantID, vehicleToSave);
    // Update Vehicle's Image
    if (filteredRequest.withVehicleImages) {
      await VehicleStorage.saveVehicleImages(req.user.tenantID, { id: updatedVehicle, images: vehicleToSave.images });
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'VehicleService', method: 'handleUpdateVehicle',
      message: `Vehicle '${vehicleToSave.model}' has been updated successfully`,
      action: action, detailedMessages: updatedVehicle });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static _checkIfVehicleValid(filteredRequest, req: Request) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id);
    }
    if (!filteredRequest.type) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle Type is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.model) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle Model is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.vehicleManufacturerID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle Manufacturer is mandatory', Constants.HTTP_GENERAL_ERROR,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id, filteredRequest.id);
    }
  }
}
