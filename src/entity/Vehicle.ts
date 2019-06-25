import TenantHolder from './TenantHolder';
import Database from '../utils/Database';
import Constants from '../utils/Constants';
import AppError from '../exception/AppError';
import VehicleStorage from '../storage/mongodb/VehicleStorage';
import User from './User';
export default class Vehicle extends TenantHolder {
  private _model: any = {};

  constructor(tenantID: any, vehicle: any) {
    super(tenantID);
    Database.updateVehicle(vehicle, this._model);
  }

  public getModel(): any {
    return this._model;
  }

  getName() {
    return `${this.getManufacturer()} ${this.getVehicleModel()}`;
  }

  getID() {
    return this._model.id;
  }

  getType() {
    return this._model.type;
  }

  setType(type) {
    this._model.type = type;
  }

  getManufacturer() {
    return this._model.manufacturer;
  }

  setManufacturer(manufacturer) {
    this._model.manufacturer = manufacturer;
  }

  getBatteryKW() {
    return this._model.batteryKW;
  }

  setBatteryKW(batteryKW) {
    this._model.batteryKW = batteryKW;
  }

  getAutonomyKmWLTP() {
    return this._model.autonomyKmWLTP;
  }

  setAutonomyKmWLTP(autonomyKmWLTP) {
    this._model.autonomyKmWLTP = autonomyKmWLTP;
  }

  setAutonomyKmReal(autonomyKmReal) {
    this._model.autonomyKmReal = autonomyKmReal;
  }

  getAutonomyKmReal() {
    return this._model.autonomyKmReal;
  }

  setHorsePower(horsePower) {
    this._model.horsePower = horsePower;
  }

  getHorsePower() {
    return this._model.horsePower;
  }

  setTorqueNm(torqueNm) {
    this._model.torqueNm = torqueNm;
  }

  getTorqueNm() {
    return this._model.torqueNm;
  }

  setPerformance0To100kmh(performance0To100kmh) {
    this._model.performance0To100kmh = performance0To100kmh;
  }

  getPerformance0To100kmh() {
    return this._model.performance0To100kmh;
  }

  setWeightKg(weightKg) {
    this._model.weightKg = weightKg;
  }

  getWeightKg() {
    return this._model.weightKg;
  }

  setLengthMeter(lengthMeter) {
    this._model.lengthMeter = lengthMeter;
  }

  getLengthMeter() {
    return this._model.lengthMeter;
  }

  setWidthMeter(widthMeter) {
    this._model.widthMeter = widthMeter;
  }

  getWidthMeter() {
    return this._model.widthMeter;
  }

  setHeightMeter(heightMeter) {
    this._model.heightMeter = heightMeter;
  }

  getHeightMeter() {
    return this._model.heightMeter;
  }

  setVehicleModel(model) {
    this._model.model = model;
  }

  getVehicleModel() {
    return this._model.model;
  }

  setImages(images) {
    this._model.images = images;
  }

  getImages() {
    return this._model.images;
  }

  getLogo() {
    return this._model.logo;
  }

  setLogo(logo) {
    this._model.logo = logo;
  }

  getCreatedBy() {
    if (this._model.createdBy) {
      return new User(this.getTenantID(), this._model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this._model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn) {
    this._model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this._model.lastChangedBy) {
      return new User(this.getTenantID(), this._model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this._model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this._model.lastChangedOn = lastChangedOn;
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
        `Vehicle ID is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id);
    }
    if (!filteredRequest.type) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle Type is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.model) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle Model is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'Vehicle', 'checkIfVehicleValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.vehicleManufacturerID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Vehicle Manufacturer is mandatory`, Constants.HTTP_GENERAL_ERROR,
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
