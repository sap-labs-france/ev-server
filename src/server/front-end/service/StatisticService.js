const Logging = require('../../../utils/Logging');
const moment = require('moment');
const Constants = require('../../../utils/Constants');
const Authorizations = require('../../../authorization/Authorizations');
const StatisticSecurity = require('./security/StatisticSecurity');
const StatisticsStorage = require('../../../storage/mongodb/StatisticsStorage');

class StatisticService {
	
  static async handleUserUsageStatistics(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = StatisticSecurity.filterUserStatisticsRequest(req.query, req.user);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactions = await StatisticsStorage.getUserStats(req.user.tenantID, filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_USAGE);
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
      const filteredRequest = StatisticSecurity.filterUserStatisticsRequest(req.query, req.user);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactions = await StatisticsStorage.getUserStats(req.user.tenantID, filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_CONSUMPTION);
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
      const filteredRequest = StatisticSecurity.filterChargingStationStatisticsRequest(req.query, req.user);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactions = await StatisticsStorage.getChargingStationStats(req.user.tenantID, filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_USAGE);
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
      const filteredRequest = StatisticSecurity.filterChargingStationStatisticsRequest(req.query, req.user);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactions = await StatisticsStorage.getChargingStationStats(req.user.tenantID, filter, filteredRequest.SiteID, Constants.STATS_GROUP_BY_CONSUMPTION);
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static buildFilter(filteredRequest, loggedUser) {
    // Only completed transactions
    const filter = { stop: {$exists: true} };
    // Date
    if (filteredRequest.Year) {
      filter.startDateTime = moment().year(filteredRequest.Year).startOf('year').toDate().toISOString();
      filter.endDateTime = moment().year(filteredRequest.Year).endOf('year').toDate().toISOString();
    } else {
      filter.startDateTime = moment().startOf('year').toDate().toISOString();
      filter.endDateTime = moment().endOf('year').toDate().toISOString();
    }
    // Check
    if (Authorizations.isBasic(loggedUser)) {
      // Only for current user
      filter.userID = loggedUser.id;
    }
    return filter
  } 
}

module.exports = StatisticService;
