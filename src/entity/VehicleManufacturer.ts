import TenantHolder from './TenantHolder';
import Database from '../utils/Database';
import User from './User';
import Vehicle from './Vehicle';
import Constants from '../utils/Constants';
import AppError from '../exception/AppError';
import VehicleManufacturerStorage from '../storage/mongodb/VehicleManufacturerStorage';
import VehicleStorage from '../storage/mongodb/VehicleStorage';

export default class VehicleManufacturer extends TenantHolder {

  private model: any = {};

  constructor(tenantID, vehicleManufacturer) {
    super(tenantID);
    // Set it
    Database.updateVehicleManufacturer(vehicleManufacturer, this.model);
  }

  public getModel(): any {
    return this.model;
  }

  getID() {
    return this.model.id;
  }

  setName(name) {
    this.model.name = name;
  }

  getName() {
    return this.model.name;
  }

  getLogo() {
    return this.model.logo;
  }

  setLogo(logo) {
    this.model.logo = logo;
  }

  getCreatedBy() {
    if (this.model.createdBy) {
      return new User(this.getTenantID(), this.model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this.model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this.model.createdOn;
  }

  setCreatedOn(createdOn) {
    this.model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this.model.lastChangedBy) {
      return new User(this.getTenantID(), this.model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this.model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this.model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this.model.lastChangedOn = lastChangedOn;
  }

  async getVehicles() {
    if (this.model.vehicles) {
      return this.model.vehicles.map((vehicle) => new Vehicle(this.getTenantID(), vehicle));
    } else {
      // Get from DB
      const vehicles = await VehicleStorage.getVehicles(this.getTenantID(), { 'vehicleManufacturerID': this.getID() });
      // Keep it
      this.setVehicles(vehicles.result);
      // Return
      return vehicles.result;
    }
  }

  setVehicles(vehicles) {
    this.model.vehicles = vehicles.map((vehicle) => {
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

  static checkIfVehicleManufacturerValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle Manufacturer ID is mandatory`, 500,
        'VehicleManufacturer', 'checkIfVehicleManufacturerValid',
        req.user.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle Manufacturer Name is mandatory`, 500,
        'VehicleManufacturer', 'checkIfVehicleManufacturerValid',
        req.user.id, filteredRequest.id);
    }
  }

  static getVehicleManufacturer(tenantID, id) {
    return VehicleManufacturerStorage.getVehicleManufacturer(tenantID, id);
  }

  static getVehicleManufacturers(tenantID, params, limit, skip, sort) {
    return VehicleManufacturerStorage.getVehicleManufacturers(tenantID, params, limit, skip, sort);
  }

  static getVehicleManufacturerLogo(tenantID, id) {
    return VehicleManufacturerStorage.getVehicleManufacturerLogo(tenantID, id);
  }

  static getVehicleManufacturerLogos(tenantID) {
    return VehicleManufacturerStorage.getVehicleManufacturerLogos(tenantID);
  }
}
