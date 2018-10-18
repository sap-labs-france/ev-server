const Database = require('../utils/Database');
const AppError = require('../exception/AppError');
const Constants = require('../utils/Constants');
const CompanyStorage = require('../storage/mongodb/CompanyStorage');
const SiteStorage = require('../storage/mongodb/SiteStorage');
const SiteAreaStorage = require('../storage/mongodb/SiteAreaStorage');
const UserStorage = require('../storage/mongodb/UserStorage');

class Site {
	constructor(tenant, site) {
		// Init model
		this._model = {};
		this._tenant = tenant;

		// Set it
		Database.updateSite(site, this._model);
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

	setAvailableChargers(availableChargers) {
		this._model.availableChargers = availableChargers;
	}

	getAvailableChargers() {
		return this._model.availableChargers;
	}

	setAddress(address) {
		this._model.address = address;
	}

	getAddress() {
		return this._model.address;
	}

	setAllowAllUsersToStopTransactionsEnabled(allowAllUsersToStopTransactions) {
		this._model.allowAllUsersToStopTransactions = allowAllUsersToStopTransactions;
	}

	isAllowAllUsersToStopTransactionsEnabled() {
		return this._model.allowAllUsersToStopTransactions;
	}

	setImage(image) {
		this._model.image = image;
	}

	getImage() {
		return this._model.image;
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

	async getCompany() {
		if (this._model.company) {
			return new Company(this._tenant, this._model.company);
		} else if (this._model.companyID){
			// Get from DB
			let company = await CompanyStorage.getCompany(this._tenant, this._model.companyID);
			// Keep it
			this.setCompany(company);
			return company;
		}
	}

	getCompanyID() {
		return this._model.companyID;
	}

	setCompany(company) {
		if (company) {
			this._model.company = company.getModel();
			this._model.companyID = company.getID();
		} else {
			this._model.company = null;
		}
	}

	async getSiteAreas() {
		if (this._model.sites) {
			return this._model.siteAreas.map((siteArea) => new SiteArea(this._tenant, siteArea));
		} else {
			// Get from DB
			let siteAreas = await SiteAreaStorage.getSiteAreas(this._tenant, {'siteID': this.getID()});
			// Keep it
			this.setSiteAreas(siteAreas.result);
			return siteAreas.result;
		}
	}

	setSiteAreas(siteAreas) {
		this._model.siteAreas = siteAreas.map((siteArea) => siteArea.getModel());
	}

	async getUsers() {
		if (this._model.users) {
			return this._model.users.map((user) => new User(this._tenant, user));
		} else {
			// Get from DB
			let users = await UserStorage.getUsers(this._tenant, {'siteID': this.getID()});
			// Keep it
			this.setUsers(users.result);
			return users.result;
		}
	}

	async getUser(userID) {
		// Get from DB
		let users = await UserStorage.getUsers(this._tenant, {'siteID': this.getID(), 'userID': userID});
		// Check
		if (users.count > 0) {
			return users.result[0];
		}
		// None
		return null;
	}

	removeUser(user) {
		if (this._model.users) {
			// Search
			for (var i = 0; i < this._model.users.length; i++) {
				if (this._model.users[i].id == user.getID()) {
					// Remove
					this._model.users.splice(i, 1);
					break;
				}
			}
		}
	}

	setUsers(users) {
		this._model.users = users.map((user) => user.getModel());
	}

	save() {
		return SiteStorage.saveSite(this._tenant, this.getModel());
	}

	saveImage() {
		return SiteStorage.saveSiteImage(this._tenant, this.getModel());
	}

	delete() {
		return SiteStorage.deleteSite(this._tenant, this.getID());
	}

	static checkIfSiteValid(filteredRequest, request) {
		// Update model?
		if(request.method !== 'POST' && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site ID is mandatory`, 500,
				'Site', 'checkIfSiteValid');
		}
		if(!filteredRequest.name) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site Name is mandatory`, 500,
				'Site', 'checkIfSiteValid');
		}
		if(!filteredRequest.companyID) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Company ID is mandatory for the Site`, 500,
				'Sites', 'checkIfSiteValid');
		}
	}

	static getSite(tenant, id, withCompany, withUser) {
		return SiteStorage.getSite(tenant, id, withCompany, withUser);
	}

	static getSites(tenant, params, limit, skip, sort) {
		return SiteStorage.getSites(tenant, params, limit, skip, sort)
	}

	static getSiteImage(tenant, id) {
		return SiteStorage.getSiteImage(tenant, id);
	}

	static getSiteImages(tenant) {
		return SiteStorage.getSiteImages(tenant)
	}
}

module.exports = Site;
