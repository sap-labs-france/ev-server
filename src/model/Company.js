const Database = require('../utils/Database');
const AppError = require('../exception/AppError');
const Constants = require('../utils/Constants');
const SiteStorage = require('../storage/mongodb/SiteStorage');
const CompanyStorage = require('../storage/mongodb/CompanyStorage');

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

	static checkIfCompanyValid(filteredRequest, req) {
		// Update model?
		if(req.method !== 'POST' && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Company ID is mandatory`, 500, 
				'Company', 'checkIfCompanyValid');
		}
		if(!filteredRequest.name) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Company Name is mandatory`, 500, 
				'Company', 'checkIfCompanyValid');
		}
	}

	async getSites() {
		if (this._model.sites) {
			return this._model.sites.map((site) => new Site(site));
		} else {
			// Get from DB
			let sites = await SiteStorage.getSites({'companyID': this.getID()});
			// Keep it
			this.setSites(sites);
			return sites;
		}
	}

	setSites(sites) {
		this._model.sites = sites.map((site) => site.getModel());
	}

	save() {
		return CompanyStorage.saveCompany(this.getModel());
	}

	saveLogo() {
		return CompanyStorage.saveCompanyLogo(this.getModel());
	}

	delete() {
		return CompanyStorage.deleteCompany(this.getID());
	}
}

module.exports = Company;
