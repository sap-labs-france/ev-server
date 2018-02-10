var Database = require('../utils/Database');
var Constants = require('../utils/Constants');

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

	getSite() {
		if (this._model.site) {
			return Promise.resolve(new Site(this._model.site));
		} else if (this._model.siteID){
			// Get from DB
			return global.storage.getSite(this._model.siteID).then((site) => {
				// Keep it
				this.setSite(site);
				return site;
			});
		} else {
			return Promise.resolve(null);
		}
	}

	setSite(site) {
		if (site) {
			this._model.site = site.getModel();
		} else {
			this._model.site = null;
		}
	}

	save() {
		return global.storage.saveSiteArea(this.getModel());
	}

	delete() {
		return global.storage.deleteSiteArea(this.getID());
	}

	getChargingStations() {
		if (this._model.chargingStations) {
			return Promise.resolve(this._model.chargingStations.map((chargingStation) => {
				return new ChargingStation(chargingStation);
			}));
		} else {
			// Get from DB
			return global.storage.getChargingStations(null, this.getID(), Constants.NO_LIMIT).then((chargingStations) => {
				// Keep it
				this.setChargingStations(chargingStations);
				return chargingStations;
			});
		}
	}

	setChargingStations(chargingStations) {
		this._model.chargingStations = chargingStations.map((chargingStation) => {
			return chargingStation.getModel();
		});
	}
}

module.exports = SiteArea;
