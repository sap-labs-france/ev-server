import AppError from '../exception/AppError';
import Constants from '../utils/Constants';
import Database from '../utils/Database';
import TenantHolder from './TenantHolder';
import User from '../types/User';
import Vehicle from './Vehicle';
import VehicleManufacturerStorage from '../storage/mongodb/VehicleManufacturerStorage';
import VehicleStorage from '../storage/mongodb/VehicleStorage';

export default class VehicleManufacturer extends TenantHolder {
  private _model: any = {};

  constructor(tenantID: any, vehicleManufacturer: any) {
    super(tenantID);
    Database.updateVehicleManufacturer(vehicleManufacturer, this._model);
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

  static getVehicleManufacturer(tenantID, id) {
    return VehicleManufacturerStorage.getVehicleManufacturer(tenantID, id);
  }

  static getVehicleManufacturers(tenantID, params, dbParams) {
    return VehicleManufacturerStorage.getVehicleManufacturers(tenantID, params, dbParams);
  }

  static getVehicleManufacturerLogo(tenantID, id) {
    return VehicleManufacturerStorage.getVehicleManufacturerLogo(tenantID, id);
  }

  static getVehicleManufacturerLogos(tenantID) {
    return VehicleManufacturerStorage.getVehicleManufacturerLogos(tenantID);
  }

  public getModel(): any {
    return this._model;
  }

  getID() {
    return this._model.id;
  }

  setName(name) {
    this._model.name = name;
  }

  getName() {
    return this._model.name;
  }

  getLogo() {
    return this._model.logo;
  }

  setLogo(logo) {
    this._model.logo = logo;
  }

  getCreatedBy() {
    if (this._model.createdBy) {
      return this._model.createdBy;
    }
    return null;
  }

  setCreatedBy(user: Partial<User>) {
    this._model.createdBy = user;
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn) {
    this._model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this._model.lastChangedBy) {
      return this._model.lastChangedBy;
    }
    return null;
  }

  setLastChangedBy(user: Partial<User>) {
    this._model.lastChangedBy = user;
  }

  getLastChangedOn() {
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this._model.lastChangedOn = lastChangedOn;
  }

  async getVehicles() {
    if (this._model.vehicles) {
      return this._model.vehicles.map((vehicle) => {
        return new Vehicle(this.getTenantID(), vehicle);
      });
    }
    const vehicles = await VehicleStorage.getVehicles(this.getTenantID(), { 'vehicleManufacturerID': this.getID() });
    this.setVehicles(vehicles.result);
    return vehicles.result;

  }

  setVehicles(vehicles) {
    this._model.vehicles = vehicles.map((vehicle) => {
      return vehicle.getModel();
    });
  }

  save() {
    return VehicleManufacturerStorage.saveVehicleManufacturer(this.getTenantID(), this.getModel());
  }

  saveLogo() {
    return VehicleManufacturerStorage.saveVehicleManufacturerLogo(this.getTenantID(), this.getModel());
  }

  delete() {
    return VehicleManufacturerStorage.deleteVehicleManufacturer(this.getTenantID(), this.getID());
  }
}
