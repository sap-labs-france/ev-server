import TenantHolder from './TenantHolder';
import Database from '../utils/Database';
import Constants from '../utils/Constants';
import AppError from '../exception/AppError';
import VehicleStorage from '../storage/mongodb/VehicleStorage';
import User from './User';
export default class Vehicle extends TenantHolder {

  private model: any = {};

  constructor(tenantID, vehicle) {
    super(tenantID);
    // Set it
    Database.updateVehicle(vehicle, this.model);
  }

  public getModel(): any {
    return this.model;
  }

  getName() {
    return `${this.getManufacturer()} ${this.getVehicleModel()}`;
  }

  getID() {
    return this.model.id;
  }

  getType() {
    return this.model.type;
  }

  setType(type) {
    this.model.type = type;
  }

  getManufacturer() {
    return this.model.manufacturer;
  }

  setManufacturer(manufacturer) {
    this.model.manufacturer = manufacturer;
  }

  getBatteryKW() {
    return this.model.batteryKW;
  }

  setBatteryKW(batteryKW) {
    this.model.batteryKW = batteryKW;
  }

  getAutonomyKmWLTP() {
    return this.model.autonomyKmWLTP;
  }

  setAutonomyKmWLTP(autonomyKmWLTP) {
    this.model.autonomyKmWLTP = autonomyKmWLTP;
  }

  setAutonomyKmReal(autonomyKmReal) {
    this.model.autonomyKmReal = autonomyKmReal;
  }

  getAutonomyKmReal() {
    return this.model.autonomyKmReal;
  }

  setHorsePower(horsePower) {
    this.model.horsePower = horsePower;
  }

  getHorsePower() {
    return this.model.horsePower;
  }

  setTorqueNm(torqueNm) {
    this.model.torqueNm = torqueNm;
  }

  getTorqueNm() {
    return this.model.torqueNm;
  }

  setPerformance0To100kmh(performance0To100kmh) {
    this.model.performance0To100kmh = performance0To100kmh;
  }

  getPerformance0To100kmh() {
    return this.model.performance0To100kmh;
  }

  setWeightKg(weightKg) {
    this.model.weightKg = weightKg;
  }

  getWeightKg() {
    return this.model.weightKg;
  }

  setLengthMeter(lengthMeter) {
    this.model.lengthMeter = lengthMeter;
  }

  getLengthMeter() {
    return this.model.lengthMeter;
  }

  setWidthMeter(widthMeter) {
    this.model.widthMeter = widthMeter;
  }

  getWidthMeter() {
    return this.model.widthMeter;
  }

  setHeightMeter(heightMeter) {
    this.model.heightMeter = heightMeter;
  }

  getHeightMeter() {
    return this.model.heightMeter;
  }

  setVehicleModel(model) {
    this.model.model = model;
  }

  getVehicleModel() {
    return this.model.model;
  }

  setImages(images) {
    this.model.images = images;
  }

  getImages() {
    return this.model.images;
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

  save() {
    return VehicleStorage.saveVehicle(this.getTenantID(), this.getModel());
  }

  saveImages() {
    return VehicleStorage.saveVehicleImages(this.getTenantID(), this.getModel());
  }

  delete() {
    return VehicleStorage.deleteVehicle(this.getTenantID(), this.getID());
  }

  static checkIfVehicleValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle ID is mandatory`, 500,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id);
    }
    if (!filteredRequest.type) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle Type is mandatory`, 500,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.model) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle Model is mandatory`, 500,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.vehicleManufacturerID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle Manufacturer is mandatory`, 500,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id, filteredRequest.id);
    }
  }

  static getVehicle(tenantID, id) {
    return VehicleStorage.getVehicle(tenantID, id);
  }

  static getVehicles(tenantID, params, limit, skip, sort) {
    return VehicleStorage.getVehicles(tenantID, params, limit, skip, sort);
  }

  static getVehicleImage(tenantID, id) {
    return VehicleStorage.getVehicleImage(tenantID, id);
  }

  static getVehicleImages(tenantID) {
    return VehicleStorage.getVehicleImages(tenantID);
  }
}
