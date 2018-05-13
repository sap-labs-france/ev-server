const Database = require('../utils/Database');
const SiteArea = require('./SiteArea');
const Company = require('./Company');

class Site {
	constructor(site) {
		// Init model
		this._model = {};

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

	setAddress(address) {
		this._model.address = address;
	}

	getAddress() {
		return this._model.address;
	}

	setImage(image) {
		this._model.image = image;
	}

	getImage() {
		return this._model.image;
	}

	setGps(gps) {
		this._model.gps = gps;
	}

	getGps() {
		return this._model.gps;
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

	getCompany(withUser=false) {
		if (this._model.company) {
			return Promise.resolve(new Company(this._model.company));
		} else if (this._model.companyID){
			// Get from DB
			return global.storage.getCompany(this._model.companyID, withUser).then((company) => {
				// Keep it
				this.setCompany(company);
				return company;
			});
		} else {
			return Promise.resolve(null);
		}
	}

	setCompany(company) {
		if (company) {
			this._model.company = company.getModel();
			this._model.companyID = company.getID();
		} else {
			this._model.company = null;
		}
	}

	getSiteAreas() {
		if (this._model.sites) {
			return Promise.resolve(this._model.siteAreas.map((siteArea) => {
				return new SiteArea(siteArea);
			}));
		} else {
			// Get from DB
			return global.storage.getSiteAreas(null, this.getID()).then((siteAreas) => {
				// Keep it
				this.setSiteAreas(siteAreas);
				return siteAreas;
			});
		}
	}

	setSiteAreas(siteAreas) {
		this._model.siteAreas = siteAreas.map((siteArea) => {
			return siteArea.getModel();
		});
	}

	save() {
		return global.storage.saveSite(this.getModel());
	}

	saveImage() {
		return global.storage.saveSiteImage(this.getModel());
	}

	delete() {
		return global.storage.deleteSite(this.getID());
	}
}

module.exports = Site;
