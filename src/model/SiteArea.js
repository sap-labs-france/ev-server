const Database = require('../utils/Database');
const Constants = require('../utils/Constants');
const AppError = require('../exception/AppError');
const SiteStorage = require('../storage/mongodb/SiteStorage');
const SiteAreaStorage = require('../storage/mongodb/SiteAreaStorage');
const ChargingStationStorage = require('../storage/mongodb/ChargingStationStorage');

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

	async getSite(tenant, withCompany=false, withUser=false) {

		if (this._model.site) {
			return new Site(this._model.site);
		} else if (this._model.siteID){
			// Get from DB
			let site = await SiteStorage.getSite(tenant, this._model.siteID, withCompany, withUser);
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

	save(tenant) {
		return SiteAreaStorage.saveSiteArea(tenant, this.getModel());
	}

	saveImage(tenant) {
		return SiteAreaStorage.saveSiteAreaImage(tenant, this.getModel());
	}

	delete(tenant) {
		return SiteAreaStorage.deleteSiteArea(tenant, this.getID());
	}

	async getChargingStations(tenant) {
		if (this._model.chargeBoxes) {
			return this._model.chargeBoxes.map((chargeBox) => new ChargingStation(chargeBox));
		} else {
			// Get from DB
			let chargingStations = await ChargingStationStorage.getChargingStations(tenant,
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

	static getSiteArea(tenant, id, withChargeBoxes, withSite) {
		return SiteAreaStorage.getSiteArea(tenant, id, withChargeBoxes, withSite);
	}

	static getSiteAreas(tenant, params, limit, skip, sort) {
		return SiteAreaStorage.getSiteAreas(tenant, params, limit, skip, sort)
	}

	static getSiteAreaImage(tenant, id) {
		return SiteAreaStorage.getSiteAreaImage(tenant, id);
	}

	static getSiteAreaImages(tenant) {
		return SiteAreaStorage.getSiteAreaImages(tenant)
	}
}

module.exports = SiteArea;
