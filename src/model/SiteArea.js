var Database = require('../utils/Database');

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

	setSiteID(siteID) {
		this._model.siteID = siteID;
	}

	getSiteID() {
		return this._model.siteID;
	}

	save() {
		return global.storage.saveSiteArea(this.getModel());
	}

	delete() {
		return global.storage.deleteSiteArea(this.getID());
	}
}

module.exports = SiteArea;
