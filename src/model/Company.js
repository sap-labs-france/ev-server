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

	getSites() {
		if (this._model.sites) {
			return Promise.resolve(this._model.sites.map((site) => {
				return new Site(site);
			}));
		} else {
			// Get from DB
			return global.storage.getSites(null, this.getID()).then((sites) => {
				// Keep it
				this.setSites(sites);
				return sites;
			});
		}
	}

	setSites(sites) {
		this._model.sites = sites.map((site) => {
			return site.getModel();
		});
	}

	save() {
		return global.storage.saveCompany(this.getModel());
	}

	saveLogo() {
		return global.storage.saveCompanyLogo(this.getModel());
	}

	delete() {
		return global.storage.deleteCompany(this.getID());
	}
}

module.exports = Company;
