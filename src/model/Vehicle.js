const Database = require('../utils/Database');
const Constants = require('../utils/Constants');
const AppError = require('../exception/AppError');
const VehicleStorage = require('../storage/mongodb/VehicleStorage');
const User = require('./User');

class Vehicle {
	constructor(vehicle) {
		// Init model
		this._model = {};
		// Set it
		Database.updateVehicle(vehicle, this._model);
	}

	getModel() {
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

	setPerformance0To100kmh(torqueNm) {
		this._model.performance0To100kmh = performance0To100kmh;
	}

	getPerformance0To100kmh() {
		return this._model.performance0To100kmh;
	}

	setWeightKg(torqueNm) {
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
			return new User(this._model.createdBy);
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
			return new User(this._model.lastChangedBy);
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

	save(tenant) {
		return VehicleStorage.saveVehicle(tenant, this.getModel());
	}

	saveImages(tenant) {
		return VehicleStorage.saveVehicleImages(tenant, this.getModel());
	}

	delete(tenant) {
		return VehicleStorage.deleteVehicle(tenant, this.getID());
	}

	static checkIfVehicleValid(request, httpRequest) {
		// Update model?
		if(httpRequest.method !== 'POST' && !request.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle ID is mandatory`, 500, 
				'Vehicle', 'checkIfVehicleValid');
		}
		if(!request.type) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle Type is mandatory`, 500, 
				'Vehicle', 'checkIfVehicleValid');
		}
		if(!request.model) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle Model is mandatory`, 500, 
				'Vehicle', 'checkIfVehicleValid');
		}
		if(!request.vehicleManufacturerID) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Vehicle Manufacturer is mandatory`, 500, 
				'Vehicle', 'checkIfVehicleValid');
		}
	}

	static getVehicle(tenant, id) {
		return VehicleStorage.getVehicle(tenant, id);
	}

	static getVehicles(tenant, params, limit, skip, sort) {
		return VehicleStorage.getVehicles(tenant, params, limit, skip, sort)
	}

	static getVehicleImage(tenant, id) {
		return VehicleStorage.getVehicleImage(tenant, id);
	}

	static getVehicleImages(tenant) {
		return VehicleStorage.getVehicleImages(tenant)
	}
}

module.exports = Vehicle;
