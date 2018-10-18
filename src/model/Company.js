const Database = require('../utils/Database');
const AppError = require('../exception/AppError');
const Constants = require('../utils/Constants');
const CompanyStorage = require('../storage/mongodb/CompanyStorage');
const SiteStorage = require('../storage/mongodb/SiteStorage');

class Company {
	constructor(tenant, company) {
		// Init model
		this._model = {};
		this._tenant = tenant;

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

	async getSites() {
		if (this._model.sites) {
			return this._model.sites.map((site) => new Site(this._tenant, site));
		} else {
			// Get from DB
			let sites = await SiteStorage.getSites(this._tenant, {'companyID': this.getID()});
			// Keep it
			this.setSites(sites.result);
			return sites.result;
		}
	}

	setSites(sites) {
		this._model.sites = sites.map((site) => site.getModel());
	}

	save() {
		return CompanyStorage.saveCompany(this._tenant, this.getModel());
	}

	saveLogo() {
		return CompanyStorage.saveCompanyLogo(this._tenant, this.getModel());
	}

	delete() {
		return CompanyStorage.deleteCompany(this._tenant, this.getID());
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

	static getCompany(tenant, id) {
		return CompanyStorage.getCompany(tenant, id);
	}

	static getCompanies(tenant, params, limit, skip, sort) {
		return CompanyStorage.getCompanies(tenant, params, limit, skip, sort)
	}

	static getCompanyLogo(tenant, id) {
		return CompanyStorage.getCompanyLogo(tenant, id);
	}

	static getCompanyLogos(tenant) {
		return CompanyStorage.getCompanyLogos(tenant);
	}
}

module.exports = Company;
