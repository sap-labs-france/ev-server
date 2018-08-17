const Constants = require('./Constants');
const AppError = require('../exception/AppError');

require('source-map-support').install();

module.exports = {
	WITH_CHARGING_STATIONS: true,
	WITHOUT_CHARGING_STATIONS: false,
	WITH_SITE: true,
	WITHOUT_SITE: false,

	checkIfSiteAreaValid(filteredRequest, request) {
		// Update model?
		if(request.method !== 'POST' && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site Area ID is mandatory`, 500, 
				'SiteAreas', 'checkIfSiteAreaValid');
		}
		if(!filteredRequest.name) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site Area Name is mandatory`, 500, 
				'SiteAreas', 'checkIfSiteAreaValid');
		}
		if(!filteredRequest.siteID) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site ID is mandatory`, 500, 
				'SiteAreas', 'checkIfSiteAreaValid');
		}
		if (!filteredRequest.chargeBoxIDs) {
			filteredRequest.chargeBoxIDs = [];
		}
	}
};
