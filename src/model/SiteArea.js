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
		}
	}

	save() {
		return global.storage.saveSiteArea(this.getModel());
	}

	delete() {
		return global.storage.deleteSiteArea(this.getID());
	}
}

module.exports = SiteArea;
