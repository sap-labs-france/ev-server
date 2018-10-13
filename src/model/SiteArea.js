const Database = require('../utils/Database');
const Constants = require('../utils/Constants');
const AppError = require('../exception/AppError');
const SiteAreaStorage = require('../storage/mongodb/SiteAreaStorage');
const ChargingStation = require('./ChargingStation');
const Site = require('./Site');

class SiteArea {
	constructor(siteArea) {
		// Init model
		this._model = {};

		// Set it
		Database.updateSiteArea(siteArea, this._model);
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

	setAccessControlEnabled(accessControl) {
		this._model.accessControl = accessControl;
	}

	isAccessControlEnabled() {
		return this._model.accessControl;
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

	setImage(image) {
		this._model.image = image;
	}

	getImage() {
		return this._model.image;
	}

	async getSite(withCompany=false, withUser=false) {
		if (this._model.site) {
			return new Site(this._model.site);
		} else if (this._model.siteID){
			// Get from DB
			let site = await Site.getSite(this._model.siteID, withCompany, withUser);
			// Keep it
			this.setSite(site);
			return site;
		}
	}

	setSite(site) {
		if (site) {
			this._model.site = site.getModel();
			this._model.siteID = site.getID();
		} else {
			this._model.site = null;
		}
	}

	save() {
		return SiteAreaStorage.saveSiteArea(this.getModel());
	}

	saveImage() {
		return SiteAreaStorage.saveSiteAreaImage(this.getModel());
	}

	delete() {
		return SiteAreaStorage.deleteSiteArea(this.getID());
	}

	async getChargingStations() {
		if (this._model.chargeBoxes) {
			return this._model.chargeBoxes.map((chargeBox) => new ChargingStation(chargeBox));
		} else {
			// Get from DB
			let chargingStations = await ChargingStation.getChargingStations(
				{ siteAreaID: this.getID() }, Constants.NO_LIMIT);
			// Keep it
			this.setChargingStations(chargingStations.result);
			return chargingStations.result;
		}
	}

	setChargingStations(chargeBoxes) {
		this._model.chargeBoxes = chargeBoxes.map((chargeBox) => chargeBox.getModel());
	}

	static checkIfSiteAreaValid(filteredRequest, request) {
		// Update model?
		if(request.method !== 'POST' && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site Area ID is mandatory`, 500, 
				'SiteArea', 'checkIfSiteAreaValid');
		}
		if(!filteredRequest.name) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site Area Name is mandatory`, 500, 
				'SiteArea', 'checkIfSiteAreaValid');
		}
		if(!filteredRequest.siteID) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site ID is mandatory`, 500, 
				'SiteArea', 'checkIfSiteAreaValid');
		}
		if (!filteredRequest.chargeBoxIDs) {
			filteredRequest.chargeBoxIDs = [];
		}
	}

	static getSiteArea(id) {
		return SiteAreaStorage.getSiteArea(id);
	}

	static getSiteAreas(params, limit, skip, sort) {
		return SiteAreaStorage.getSiteAreas(params, limit, skip, sort)
	}

	static getSiteAreaImage(id) {
		return SiteAreaStorage.getSiteAreaImage(id);
	}

	static getSiteAreaImages(params, limit, skip, sort) {
		return SiteAreaStorage.getSiteAreaImages(params, limit, skip, sort)
	}
}

module.exports = SiteArea;
