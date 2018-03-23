const sanitize = require('mongo-sanitize');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const Utils = require('../../../utils/Utils');
const moment = require('moment');
const Users = require('../../../utils/Users');
const Constants = require('../../../utils/Constants');
const UtilsSecurity = require('./UtilsService').UtilsSecurity;

class StatisticService {
	static handleUserUsageStatistics(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "StatisticService",
			method: "handleUserUsageStatistics",
			message: `Read User Usage Statistics`
		});
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
		// Check email
		global.storage.getTransactions(null, filter, filteredRequest.SiteID,
			Constants.NO_LIMIT).then((transactions) => {
			// filters
			transactions = transactions.filter((transaction) => {
				// Check user
				if (!CentralRestServerAuthorization.canReadTransaction(req.user, transaction)) {
					return false;
				}
				return true;
			});
			// Group Them By Month
			let monthStats = [];
			let monthStat;
			// Browse in reverse order
			for (var i = transactions.length-1; i >= 0; i--) {
				// First Init
				if (!monthStat) {
					monthStat = {};
					monthStat.month = moment(transactions[i].timestamp).month();
				}
				// Month changed?
				if (monthStat.month != moment(transactions[i].timestamp).month()) {
					// Add
					monthStats.push(monthStat);
					// Reset
					monthStat = {};
					monthStat.month = moment(transactions[i].timestamp).month();
				}

				// Set Usage
				let userName = Utils.buildUserFullName(transactions[i].user, false);
				if (!monthStat[userName]) {
					// Add Usage in Hours
					monthStat[userName] =
						(new Date(transactions[i].stop.timestamp).getTime() - new Date(transactions[i].timestamp).getTime()) / (3600 * 1000);
				} else {
					// Add Usage in Hours
					monthStat[userName] +=
						(new Date(transactions[i].stop.timestamp).getTime() - new Date(transactions[i].timestamp).getTime()) / (3600 * 1000);
				}
			}
			// Add the last month statistics
			if (monthStat) {
				monthStats.push(monthStat);
			}
			// Return
			res.json(monthStats);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetUserConsumptionStatistics(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "StatisticService",
			method: "handleGetUserConsumptionStatistics",
			message: `Read User Consumption Statistics`
		});
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
		// Check email
		global.storage.getTransactions(null, filter,
				filteredRequest.SiteID, Constants.NO_LIMIT).then((transactions) => {
			// filters
			transactions = transactions.filter((transaction) => {
				// Check user
				if (!CentralRestServerAuthorization.canReadTransaction(req.user, transaction)) {
					return false;
				}
				return true;
			});
			// Group Them By Month
			let monthStats = [];
			let monthStat;
			// Browse in reverse order
			for (var i = transactions.length-1; i >= 0; i--) {
				// First Init
				if (!monthStat) {
					monthStat = {};
					monthStat.month = moment(transactions[i].timestamp).month();
				}
				// Month changed?
				if (monthStat.month != moment(transactions[i].timestamp).month()) {
					// Add
					monthStats.push(monthStat);
					// Reset
					monthStat = {};
					monthStat.month = moment(transactions[i].timestamp).month();
				}
				// Set consumption
				let userName = Utils.buildUserFullName(transactions[i].user, false);
				if (!monthStat[userName]) {
					// Add conso in kW.h
					monthStat[userName] = transactions[i].stop.totalConsumption / 1000;
				} else {
					// Add conso in kW.h
					monthStat[userName] += transactions[i].stop.totalConsumption / 1000;
				}
			}
			// Add the last month statistics
			if (monthStat) {
				monthStats.push(monthStat);
			}
			// Return
			res.json(monthStats);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetChargingStationUsageStatistics(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "StatisticService",
			method: "handleGetChargingStationUsageStatistics",
			message: `Read Charging Station Usage Statistics`
		});
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
		// Check email
		global.storage.getTransactions(null, filter, filteredRequest.SiteID,
				Constants.NO_LIMIT).then((transactions) => {
			// filters
			transactions = transactions.filter((transaction) => {
				// Check user
				if (!CentralRestServerAuthorization.canReadTransaction(req.user, transaction)) {
					return false;
				}
				return true;
			});
			// Group Them By Month
			let monthStats = [];
			let monthStat;
			// Browse in reverse order
			for (var i = transactions.length-1; i >= 0; i--) {
				// First Init
				if (!monthStat) {
					monthStat = {};
					monthStat.month = moment(transactions[i].timestamp).month();
				}
				// Month changed?
				if (monthStat.month != moment(transactions[i].timestamp).month()) {
					// Add
					monthStats.push(monthStat);
					// Reset
					monthStat = {};
					monthStat.month = moment(transactions[i].timestamp).month();
				}
				// Set Usage
				if (!monthStat[transactions[i].chargeBox.id]) {
					// Add Usage in Hours
					monthStat[transactions[i].chargeBox.id] =
						(new Date(transactions[i].stop.timestamp).getTime() - new Date(transactions[i].timestamp).getTime()) / (3600 * 1000);
				} else {
					// Add Usage in Hours
					monthStat[transactions[i].chargeBox.id] +=
						(new Date(transactions[i].stop.timestamp).getTime() - new Date(transactions[i].timestamp).getTime()) / (3600 * 1000);
				}
			}
			// Add the last month statistics
			if (monthStat) {
				monthStats.push(monthStat);
			}
			// Return
			res.json(monthStats);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetChargingStationConsumptionStatistics(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "StatisticService",
			method: "handleGetChargingStationConsumptionStatistics",
			message: `Read Charging Station Consumption Statistics`
		});
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
		// Check email
		global.storage.getTransactions(null, filter, filteredRequest.SiteID,
				Constants.NO_LIMIT).then((transactions) => {
			// filters
			transactions = transactions.filter((transaction) => {
				// Check user
				if (!CentralRestServerAuthorization.canReadTransaction(req.user, transaction)) {
					return false;
				}
				return true;
			});
			// Group Them By Month
			let monthStats = [];
			let monthStat;
			// Browse in reverse order
			for (var i = transactions.length-1; i >= 0; i--) {
				// First Init
				if (!monthStat) {
					monthStat = {};
					monthStat.month = moment(transactions[i].timestamp).month();
				}
				// Month changed?
				if (monthStat.month != moment(transactions[i].timestamp).month()) {
					// Add
					monthStats.push(monthStat);
					// Reset
					monthStat = {};
					monthStat.month = moment(transactions[i].timestamp).month();
				}
				// Set consumption
				if (!monthStat[transactions[i].chargeBox.id]) {
					// Add conso in kW.h
					monthStat[transactions[i].chargeBox.id] = transactions[i].stop.totalConsumption / 1000;
				} else {
					// Add conso in kW.h
					monthStat[transactions[i].chargeBox.id] += transactions[i].stop.totalConsumption / 1000;
				}
			}
			// Add the last month statistics
			if (monthStat) {
				monthStats.push(monthStat);
			}
			// Return
			res.json(monthStats);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

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

module.exports = {
	"StatisticService": StatisticService,
	"StatisticSecurity": StatisticSecurity
};
