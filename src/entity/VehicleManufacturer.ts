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

}
