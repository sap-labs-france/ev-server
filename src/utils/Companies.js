const Constants = require('./Constants');
const AppError = require('../exception/AppError');

require('source-map-support').install();

module.exports = {
	checkIfCompanyValid(filteredRequest, req) {
		// Update model?
		if(req.method !== "POST" && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Company ID is mandatory`,
				500, "Companies", "checkIfCompanyValid");
		}
		if(!filteredRequest.name) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Company Name is mandatory`,
				500, "Companies", "checkIfCompanyValid");
		}
	}
};
