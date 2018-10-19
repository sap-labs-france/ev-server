const Database = require('../utils/Database');
const User = require('./User');
const Vehicle = require('./Vehicle');
const Constants = require('../utils/Constants');
const AppError = require('../exception/AppError');
const VehicleManufacturerStorage = require('../storage/mongodb/VehicleManufacturerStorage');
const VehicleStorage = require('../storage/mongodb/VehicleStorage');

class VehicleManufacturer {
	constructor(tenant, vehicleManufacturer) {
		// Init model
		this._model = {};
		this._tenant = tenant;
		// Set it
		Database.updateVehicleManufacturer(vehicleManufacturer, this._model);
	}

	getModel() {
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
			return new User(this._tenant, this._model.createdBy);
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
			return new User(this._tenant, this._model.lastChangedBy);
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

	async getVehicles() {
		if (this._model.vehicles) {
			return this._model.vehicles.map((vehicle) => new Vehicle(this._tenant, vehicle));
		} else {
			// Get from DB
			let vehicles = await VehicleStorage.getVehicles(this._tenant, {'vehicleManufacturerID': this.getID()});
			// Keep it
			this.setVehicles(vehicles.result);
			// Return
			return vehicles.result;
		}
	}

	setVehicles(vehicles) {
		this._model.vehicles = vehicles.map((vehicle) => {
			return vehicle.getModel();
		});
	}

	save() {
		return VehicleManufacturerStorage.saveVehicleManufacturer(this._tenant, this.getModel());
	}

	saveLogo() {
		return VehicleManufacturerStorage.saveVehicleManufacturerLogo(this._tenant, this.getModel());
	}

	delete() {
		return VehicleManufacturerStorage.deleteVehicleManufacturer(this._tenant, this.getID());
	}

	static checkIfVehicleManufacturerValid(filteredRequest, request) {
		// Update model?
		if(request.method !== 'POST' && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle Manufacturer ID is mandatory`, 500, 
				'VehicleManufacturer', 'checkIfVehicleManufacturerValid');
		}
		if(!filteredRequest.name) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle Manufacturer Name is mandatory`, 500, 
				'VehicleManufacturer', 'checkIfVehicleManufacturerValid');
		}
	}

	static getVehicleManufacturer(tenant, id) {
		return VehicleManufacturerStorage.getVehicleManufacturer(tenant, id);
	}

	static getVehicleManufacturers(tenant, params, limit, skip, sort) {
		return VehicleManufacturerStorage.getVehicleManufacturers(tenant, params, limit, skip, sort)
	}

	static getVehicleManufacturerLogo(tenant, id) {
		return VehicleManufacturerStorage.getVehicleManufacturerLogo(tenant, id);
	}

	static getVehicleManufacturerLogos(tenant) {
		return VehicleManufacturerStorage.getVehicleManufacturerLogos(tenant);
	}
}

module.exports = VehicleManufacturer;
