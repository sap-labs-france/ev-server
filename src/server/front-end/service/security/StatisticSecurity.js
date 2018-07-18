const sanitize = require('mongo-sanitize');

class StatisticSecurity {
	static filterUserStatisticsRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.Year = sanitize(request.Year);
		filteredRequest.SiteID = sanitize(request.SiteID);
		return filteredRequest;
	}

	static filterChargingStationStatisticsRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.Year = sanitize(request.Year);
		filteredRequest.SiteID = sanitize(request.SiteID);
		return filteredRequest;
	}
}

module.exports = StatisticSecurity;
