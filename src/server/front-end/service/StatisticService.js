const Logging = require('../../../utils/Logging');
const moment = require('moment');
const Constants = require('../../../utils/Constants');
const StatisticSecurity = require('./security/StatisticSecurity');

class StatisticService {
	
	static async handleUserUsageStatistics(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = StatisticSecurity.filterUserStatisticsRequest(req.query, req.user);
			// Build filter
			let filter = StatisticService.buildFilter(filteredRequest);
			// Get Stats
			let transactions = await global.storage.getUserStats(filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_USAGE);
			// Return
			res.json(transactions);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetUserConsumptionStatistics(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = StatisticSecurity.filterUserStatisticsRequest(req.query, req.user);
			// Build filter
			let filter = StatisticService.buildFilter(filteredRequest);
			// Get Stats
			let transactions = await global.storage.getUserStats(filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_CONSUMPTION);
			// Return
			res.json(transactions);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetChargingStationUsageStatistics(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = StatisticSecurity.filterChargingStationStatisticsRequest(req.query, req.user);
			// Build filter
			let filter = StatisticService.buildFilter(filteredRequest);
			// Get Stats
			let transactions = await global.storage.getChargingStationStats(filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_USAGE);
			// Return
			res.json(transactions);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetChargingStationConsumptionStatistics(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = StatisticSecurity.filterChargingStationStatisticsRequest(req.query, req.user);
			// Build filter
			let filter = StatisticService.buildFilter(filteredRequest);
			// Get Stats
			let transactions = await global.storage.getChargingStationStats(filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_CONSUMPTION);
			// Return
			res.json(transactions);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static buildFilter(filteredRequest) {
		let filter = {stop: {$exists: true}};
		// Date
		if (filteredRequest.Year) {
			filter.startDateTime = moment().year(filteredRequest.Year).startOf('year').toDate().toISOString();
			filter.endDateTime = moment().year(filteredRequest.Year).endOf('year').toDate().toISOString();
		} else {
			filter.startDateTime = moment().startOf('year').toDate().toISOString();
			filter.endDateTime = moment().endOf('year').toDate().toISOString();
		}
		return filter
	} 
}

module.exports = StatisticService;
