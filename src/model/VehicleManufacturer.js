const Database = require('../utils/Database');
const User = require('./User');
const Vehicle = require('./Vehicle');

class VehicleManufacturer {
	constructor(vehicleManufacturer) {
		// Init model
		this._model = {};
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

	getVehicles() {
		if (this._model.vehicles) {
			return Promise.resolve(this._model.vehicles.map((vehicle) => {
				return new Vehicle(vehicle);
			}));
		} else {
			// Get from DB
			return global.storage.getVehicles(null, this.getID()).then((vehicles) => {
				// Keep it
				this.setVehicles(vehicles);
				return vehicles;
			});
		}
	}

	setVehicles(vehicles) {
		this._model.vehicles = vehicles.map((vehicle) => {
			return vehicle.getModel();
		});
	}

	save() {
		return global.storage.saveVehicleManufacturer(this.getModel());
	}

	saveLogo() {
		return global.storage.saveVehicleManufacturerLogo(this.getModel());
	}

	delete() {
		return global.storage.deleteVehicleManufacturer(this.getID());
	}
}

module.exports = VehicleManufacturer;
