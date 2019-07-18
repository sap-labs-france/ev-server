import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import VehicleManufacturerSecurity from './security/VehicleManufacturerSecurity';
import VehicleManufacturerStorage from '../../../storage/mongodb/VehicleManufacturerStorage';
import Utils from '../../../utils/Utils';

export default class VehicleManufacturerService {

  public static async handleDeleteVehicleManufacturer(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const vehicleManufacturerID = VehicleManufacturerSecurity.filterVehicleManufacturerRequestByID(req.query);
    // Check Mandatory fields
    if (!vehicleManufacturerID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Vehicle Manufacturer\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'VehicleManufacturerService', 'handleDeleteVehicleManufacturer', req.user);
    }
    // Check auth
    if (!Authorizations.canDeleteVehicleManufacturer(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_VEHICLE_MANUFACTURERS,
        vehicleManufacturerID,
        Constants.HTTP_AUTH_ERROR,
        'VehicleManufacturerService', 'handleDeleteVehicleManufacturer',
        req.user);
    }
    // Get
    const vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, vehicleManufacturerID);
    if (!vehicleManufacturer) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle Manufacturer with ID '${vehicleManufacturerID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'VehicleManufacturerService', 'handleDeleteVehicleManufacturer', req.user);
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
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Vehicle Manufacturer\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'VehicleManufacturerService', 'handleGetVehicleManufacturer', req.user);
    }
    // Check auth
    if (!Authorizations.canReadVehicle(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_VEHICLE_MANUFACTURER,
        filteredRequest.ID,
        Constants.HTTP_AUTH_ERROR,
        'VehicleManufacturerService', 'handleGetVehicleManufacturer',
        req.user);
    }
    // Get it
    const vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, filteredRequest.ID);
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
        vehicleManufacturer, req.user)
    );
    next();
  }

  public static async handleGetVehicleManufacturers(action: string, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListVehicleManufacturers(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_VEHICLE_MANUFACTURERS,
        null,
        Constants.HTTP_AUTH_ERROR,
        'VehicleManufacturerService', 'handleGetVehicleManufacturers',
        req.user);
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
      throw new AppAuthError(
        Constants.ACTION_CREATE,
        Constants.ENTITY_VEHICLE_MANUFACTURERS,
        null,
        Constants.HTTP_AUTH_ERROR,
        'VehicleManufacturerService', 'handleCreateVehicleManufacturer',
        req.user);
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
        { id: vehicleManufacturer.id, logo: vehicleManufacturer.logo });
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
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_VEHICLE_MANUFACTURERS,
        filteredRequest.id,
        Constants.HTTP_AUTH_ERROR,
        'VehicleManufacturerService', 'handleUpdateVehicleManufacturer',
        req.user);
    }
    // Get
    let vehicleManufacturer = await	VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, filteredRequest.id);
    if (!vehicleManufacturer) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Vehicle Manufacturer with ID '${filteredRequest.id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'VehicleManufacturerService', 'handleUpdateVehicleManufacturer', req.user);
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
        { id: vehicleManufacturer.id, logo: vehicleManufacturer.logo });
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
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Vehicle Manufacturer\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo', req.user);
    }
    // Check auth
    if (!Authorizations.canReadVehicleManufacturer(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_COMPANY,
        vehicleManufacturerID,
        Constants.HTTP_AUTH_ERROR,
        'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo',
        req.user);
    }
    // Get it
    const vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, vehicleManufacturerID);
    if (!vehicleManufacturer) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Vehicle Manufacturer with ID '${vehicleManufacturerID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo', req.user);
    }
    // Get the logo
    const vehicleManufacturerLogo = await VehicleManufacturerStorage.getVehicleManufacturerLogo(req.user.tenantID, vehicleManufacturerID);
    // Return
    res.json(vehicleManufacturerLogo);
    next();
  }

  public static async handleGetVehicleManufacturerLogos(action: string, req: Request, res: Response, next: NextFunction) {
    // Check auth
    if (!Authorizations.canListCompanies(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_COMPANIES,
        null,
        Constants.HTTP_AUTH_ERROR,
        'VehicleManufacturerService', 'handleGetVehicleManufacturerLogos',
        req.user);
    }
    // Get the vehicle manufacturer logo
    const vehicleManufacturerLogos = await VehicleManufacturerStorage.getVehicleManufacturerLogos(req.user.tenantID);
    // Return
    res.json(vehicleManufacturerLogos);
    next();
  }
}
