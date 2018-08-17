const Constants = require('./Constants');
const AppError = require('../exception/AppError');

require('source-map-support').install();

module.exports = {
	SITE_IS_UNLOCKED: 'Site is unlocked',

	checkIfSiteValid(filteredRequest, request) {
		// Update model?
		if(request.method !== 'POST' && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site ID is mandatory`, 500, 
				'Sites', 'checkIfSiteValid');
		}
		if(!filteredRequest.name) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site Name is mandatory`, 500, 
				'Sites', 'checkIfSiteValid');
		}
		if(!filteredRequest.companyID) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Company ID is mandatory for the Site`, 500, 
				'Sites', 'checkIfSiteValid');
		}
	}
};
