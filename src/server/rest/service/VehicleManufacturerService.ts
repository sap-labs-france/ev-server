import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Database from '../../../utils/Database';
import Logging from '../../../utils/Logging';
import User from '../../../types/User';
import VehicleManufacturer from '../../../types/VehicleManufacturer';
import VehicleManufacturerSecurity from './security/VehicleManufacturerSecurity';
import VehicleManufacturerStorage from '../../../storage/mongodb/VehicleManufacturerStorage';

export default class VehicleManufacturerService {

  public static async handleDeleteVehicleManufacturer(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const ID = VehicleManufacturerSecurity.filterVehicleManufacturerRequest(
      req.query,);
    // Check Mandatory fields
    if (!ID) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Vehicle Manufacturer\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'VehicleManufacturerService', 'handleDeleteVehicleManufacturer', req.user);
    }
    // Get
    const vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, ID);
    if (!vehicleManufacturer) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle Manufacturer with ID '${ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'VehicleManufacturerService', 'handleDeleteVehicleManufacturer', req.user);
    }
    // Check auth
    if (!Authorizations.canDeleteVehicleManufacturer(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_VEHICLE_MANUFACTURERS,
        vehicleManufacturer.id,
        Constants.HTTP_AUTH_ERROR,
        'VehicleManufacturerService', 'handleDeleteVehicleManufacturer',
        req.user);
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
    const ID = VehicleManufacturerSecurity.filterVehicleManufacturerRequest(req.query);
    // Charge Box is mandatory
    if (!ID) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Vehicle Manufacturer\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'VehicleManufacturerService', 'handleGetVehicleManufacturer', req.user);
    }
    // Get it
    const vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, ID);
    if (!vehicleManufacturer) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Vehicle Manufacturer with ID '${ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
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
    const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerCreateRequest(req.body);
    // Check Mandatory fields
    VehicleManufacturerService.checkIfVehicleManufacturerValid(filteredRequest, req);
    // Create vehicleManufacturer
    const vehicleManufacturer = filteredRequest;
    // Update timestamp
    vehicleManufacturer.createdBy = { 'id': req.user.id };
    vehicleManufacturer.createdOn = new Date();
    vehicleManufacturer.lastChangedBy = vehicleManufacturer.createdBy;
    vehicleManufacturer.lastChangedOn = vehicleManufacturer.createdOn;
    // Save
    const newVehicleManufacturer = await VehicleManufacturerStorage.saveVehicleManufacturer(req.user.tenantID, vehicleManufacturer);
    // Save
    if (vehicleManufacturer.logo) {
      await VehicleManufacturerStorage.saveVehicleManufacturerLogo(req.user.tenantID, { id: newVehicleManufacturer, logo: vehicleManufacturer.logo });
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'VehicleManufacturerService', method: 'handleCreateVehicleManufacturer',
      message: `Vehicle Manufacturer '${vehicleManufacturer.name}' has been created successfully`,
      action: action, detailedMessages: vehicleManufacturer });
    // Ok
    res.json(Object.assign({ id: newVehicleManufacturer }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateVehicleManufacturer(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = VehicleManufacturerSecurity.filterVehicleManufacturerUpdateRequest(req.body);
    // Check email
    const vehicleManufacturer = await	VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, filteredRequest.id);
    if (!vehicleManufacturer) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Vehicle Manufacturer with ID '${filteredRequest.id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'VehicleManufacturerService', 'handleUpdateVehicleManufacturer', req.user);
    }
    // Check Mandatory fields
    VehicleManufacturerService.checkIfVehicleManufacturerValid(filteredRequest, req);
    // Check auth
    if (!Authorizations.canUpdateVehicleManufacturer(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_VEHICLE_MANUFACTURERS,
        vehicleManufacturer.id,
        Constants.HTTP_AUTH_ERROR,
        'VehicleManufacturerService', 'handleUpdateVehicleManufacturer',
        req.user);
    }
    // Update
    const vm = { ...vehicleManufacturer, ...filteredRequest };
    // Update timestamp
    vm.lastChangedBy = { 'id': req.user.id };
    vehicleManufacturer.lastChangedOn = new Date();
    // Update VehicleManufacturer
    const updatedVehicleManufacturer = VehicleManufacturerStorage.saveVehicleManufacturer(req.user.tenantID, vm);
    // Update VehicleManufacturer's Logo
    if (vm.logo) {
      await VehicleManufacturerStorage.saveVehicleManufacturerLogo(req.user.tenantID, { id: vm.id, logo: vm.logo });
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'VehicleManufacturerService', method: 'handleUpdateVehicleManufacturer',
      message: `Vehicle Manufacturer '${vm.name}' has been updated successfully`,
      action: action, detailedMessages: vm });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetVehicleManufacturerLogo(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const ID = VehicleManufacturerSecurity.filterVehicleManufacturerRequest(req.query);
    // Charge Box is mandatory
    if (!ID) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Vehicle Manufacturer\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo', req.user);
    }
    // Get it
    const vehicleManufacturer = await VehicleManufacturerStorage.getVehicleManufacturer(req.user.tenantID, ID);
    if (!vehicleManufacturer) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Vehicle Manufacturer with ID '${ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo', req.user);
    }
    // Check auth
    if (!Authorizations.canReadVehicleManufacturer(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_COMPANY,
        vehicleManufacturer.id,
        Constants.HTTP_AUTH_ERROR,
        'VehicleManufacturerService', 'handleGetVehicleManufacturerLogo',
        req.user);
    }
    // Get the logo
    const vehicleManufacturerLogo = await VehicleManufacturerStorage.getVehicleManufacturerLogo(req.user.tenantID, ID);
    // Return
    res.json(vehicleManufacturerLogo);
    next();
  }

  public static async handleGetVehicleManufacturerLogos(action: string, req: Request, res: Response, next: NextFunction) {
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
    const vehicleManufacturerLogos = await VehicleManufacturerStorage.getVehicleManufacturerLogos(req.user.tenantID);
    // Return
    res.json(vehicleManufacturerLogos);
    next();
  }

  static checkIfVehicleManufacturerValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle Manufacturer ID is mandatory', Constants.HTTP_GENERAL_ERROR,
        'VehicleManufacturer', 'checkIfVehicleManufacturerValid',
        req.user.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Vehicle Manufacturer Name is mandatory', Constants.HTTP_GENERAL_ERROR,
        'VehicleManufacturer', 'checkIfVehicleManufacturerValid',
        req.user.id, filteredRequest.id);
    }
  }
}
