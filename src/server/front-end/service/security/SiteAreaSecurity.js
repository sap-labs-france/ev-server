const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../utils/Authorizations');
const Utils = require('../../../../utils/Utils');
const UtilsSecurity = require('./UtilsSecurity');
let SiteSecurity; // Avoid circular deps
let ChargingStationSecurity; // Avoid circular deps

class SiteAreaSecurity {
	static getSiteSecurity() {
		if (!SiteSecurity) {
			SiteSecurity = require('./SiteSecurity');
		}
		return SiteSecurity;
	}

	static getChargingStationSecurity() {
		if (!ChargingStationSecurity) {
			ChargingStationSecurity = require('./ChargingStationSecurity');
		}
		return ChargingStationSecurity;
	}

	static filterSiteAreaDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterSiteAreaRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterSiteAreasRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.Search = sanitize(request.Search);
		filteredRequest.WithChargeBoxes = UtilsSecurity.filterBoolean(request.WithChargeBoxes);
		return filteredRequest;
	}

	static filterSiteAreaUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = SiteAreaSecurity._filterSiteAreaRequest(request, loggedUser);
		filteredRequest.id = sanitize(request.id);
		return filteredRequest;
	}

	static filterSiteAreaCreateRequest(request, loggedUser) {
		return SiteAreaSecurity._filterSiteAreaRequest(request, loggedUser);
	}

	static _filterSiteAreaRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.name = sanitize(request.name);
		filteredRequest.image = sanitize(request.image);
		filteredRequest.accessControl = UtilsSecurity.filterBoolean(request.accessControl);
		filteredRequest.siteID = sanitize(request.siteID);
		filteredRequest.chargeBoxIDs = sanitize(request.chargeBoxIDs);
		return filteredRequest;
	}

	static filterSiteAreaResponse(siteArea, loggedUser) {
		let filteredSiteArea;

		if (!siteArea) {
			return null;
		}
		// Check auth
		if (Authorizations.canReadSiteArea(loggedUser, siteArea)) {
			// Admin?
			if (Authorizations.isAdmin(loggedUser)) {
				// Yes: set all params
				filteredSiteArea = siteArea;
			} else {
				// Set only necessary info
				filteredSiteArea = {};
				filteredSiteArea.id = siteArea.id;
				filteredSiteArea.name = siteArea.name;
				filteredSiteArea.siteID = siteArea.siteID;
			}
			if (siteArea.site) {
				// Site
				filteredSiteArea.site = SiteAreaSecurity.getSiteSecurity().filterSiteResponse(siteArea.site, loggedUser);
			}
			if (siteArea.chargeBoxes) {
				filteredSiteArea.chargeBoxes = SiteAreaSecurity.getChargingStationSecurity()
					.filterChargingStationsResponse(siteArea.chargeBoxes, loggedUser );
			}
			// Created By / Last Changed By
			UtilsSecurity.filterCreatedAndLastChanged(
				filteredSiteArea, siteArea, loggedUser);
		}
		return filteredSiteArea;
	}

	static filterSiteAreasResponse(siteAreas, loggedUser) {
		let filteredSiteAreas = [];

		if (!siteAreas) {
			return null;
		}
		if (!Authorizations.canListSiteAreas(loggedUser)) {
			return null;
		}
		siteAreas.forEach(siteArea => {
			// Filter
			let filteredSiteArea = SiteAreaSecurity.filterSiteAreaResponse(siteArea, loggedUser);
			// Ok?
			if (filteredSiteArea) {
				// Add
				filteredSiteAreas.push(filteredSiteArea);
			}
		});
		return filteredSiteAreas;
	}
}

module.exports = SiteAreaSecurity;
