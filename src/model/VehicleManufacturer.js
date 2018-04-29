const Database = require('../utils/Database');
const User = require('./User');
const Car = require('./Car');

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

	getCars() {
		if (this._model.cars) {
			return Promise.resolve(this._model.cars.map((car) => {
				return new Car(car);
			}));
		} else {
			// Get from DB
			return global.storage.getCars(null, this.getID()).then((cars) => {
				// Keep it
				this.setCars(cars);
				return cars;
			});
		}
	}

	setCars(cars) {
		this._model.cars = cars.map((car) => {
			return car.getModel();
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
