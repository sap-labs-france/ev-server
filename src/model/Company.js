const Database = require('../utils/Database');

class Company {
	constructor(company) {
		// Init model
		this._model = {};

		// Set it
		Database.updateCompany(company, this._model);
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

	setAddress(address) {
		this._model.address = address;
	}

	getAddress() {
		return this._model.address;
	}

	setLogo(logo) {
		this._model.logo = logo;
	}

	getLogo() {
		return this._model.logo;
	}

	setGps(gps) {
		this._model.gps = gps;
	}

	getGps() {
		return this._model.gps;
	}

	getCreatedBy() {
		return this._model.createdBy;
	}

	setCreatedBy(createdBy) {
		this._model.createdBy = createdBy;
	}

	getCreatedOn() {
		return this._model.createdOn;
	}

	setCreatedOn(createdOn) {
		this._model.createdOn = createdOn;
	}

	getLastChangedBy() {
		return this._model.lastChangedBy;
	}

	setLastChangedBy(lastChangedBy) {
		this._model.lastChangedBy = lastChangedBy;
	}

	getLastChangedOn() {
		return this._model.lastChangedOn;
	}

	setLastChangedOn(lastChangedOn) {
		this._model.lastChangedOn = lastChangedOn;
	}

	getSites() {
		return global.storage.getSitesFromCompany(this.getID());
	}

	save() {
		return global.storage.saveCompany(this.getModel());
	}

	delete() {
		return global.storage.deleteCompany(this.getID());
	}
}

module.exports = Company;
