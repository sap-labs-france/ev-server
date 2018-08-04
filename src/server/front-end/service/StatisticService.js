const Authorizations = require('../../../authorization/Authorizations');
const Logging = require('../../../utils/Logging');
const Utils = require('../../../utils/Utils');
const moment = require('moment');
const Constants = require('../../../utils/Constants');
const StatisticSecurity = require('./security/StatisticSecurity');

class StatisticService {
	
	static handleUserUsageStatistics(action, req, res, next) {
		let filter = {stop: {$exists: true}};
		// Filter
		let filteredRequest = StatisticSecurity.filterUserStatisticsRequest(req.query, req.user);
		// Date
		if (filteredRequest.Year) {
			filter.startDateTime = moment().year(filteredRequest.Year).startOf('year').toDate().toISOString();
			filter.endDateTime = moment().year(filteredRequest.Year).endOf('year').toDate().toISOString();
		} else {
			filter.startDateTime = moment().startOf('year').toDate().toISOString();
			filter.endDateTime = moment().endOf('year').toDate().toISOString();
		}
		// Get Stats
		global.storage.getUserStats(filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_USAGE).then((transactions) => {
			// Return
			res.json(transactions);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetUserConsumptionStatistics(action, req, res, next) {
		let filter = {stop: {$exists: true}};
		// Filter
		let filteredRequest = StatisticSecurity.filterUserStatisticsRequest(req.query, req.user);
		// Date
		if (filteredRequest.Year) {
			filter.startDateTime = moment().year(filteredRequest.Year).startOf('year').toDate().toISOString();
			filter.endDateTime = moment().year(filteredRequest.Year).endOf('year').toDate().toISOString();
		} else {
			filter.startDateTime = moment().startOf('year').toDate().toISOString();
			filter.endDateTime = moment().endOf('year').toDate().toISOString();
		}
		// Get Stats
		global.storage.getUserStats(filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_CONSUMPTION).then((transactions) => {
			// Return
			res.json(transactions);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetChargingStationUsageStatistics(action, req, res, next) {
		let filter = {stop: {$exists: true}};
		// Filter
		let filteredRequest = StatisticSecurity.filterChargingStationStatisticsRequest(req.query, req.user);
		// Date
		if (filteredRequest.Year) {
			filter.startDateTime = moment().year(filteredRequest.Year).startOf('year').toDate().toISOString();
			filter.endDateTime = moment().year(filteredRequest.Year).endOf('year').toDate().toISOString();
		} else {
			filter.startDateTime = moment().startOf('year').toDate().toISOString();
			filter.endDateTime = moment().endOf('year').toDate().toISOString();
		}
		// Get Stats
		global.storage.getChargingStationStats(filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_USAGE).then((transactions) => {
			// Return
			res.json(transactions);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetChargingStationConsumptionStatistics(action, req, res, next) {
		let filter = {stop: {$exists: true}};
		// Filter
		let filteredRequest = StatisticSecurity.filterChargingStationStatisticsRequest(req.query, req.user);
		// Date
		if (filteredRequest.Year) {
			filter.startDateTime = moment().year(filteredRequest.Year).startOf('year').toDate().toISOString();
			filter.endDateTime = moment().year(filteredRequest.Year).endOf('year').toDate().toISOString();
		} else {
			filter.startDateTime = moment().startOf('year').toDate().toISOString();
			filter.endDateTime = moment().endOf('year').toDate().toISOString();
		}
		// Get Stats
		global.storage.getChargingStationStats(filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_CONSUMPTION).then((transactions) => {
			// Return
			res.json(transactions);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = StatisticService;
