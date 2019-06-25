import Logging from '../../../utils/Logging';
import moment from 'moment';
import Constants from '../../../utils/Constants';
import AppAuthError from '../../../exception/AppAuthError';
import Authorizations from '../../../authorization/Authorizations';
import StatisticSecurity from './security/StatisticSecurity';
import StatisticsStorage from '../../../storage/mongodb/StatisticsStorage';
import fs from 'fs';
import Utils from '../../../utils/Utils';

export default class StatisticService {
  static async handleUserUsageStatistics(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query, req.user);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getUserStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_USAGE);
      // Convert
      const transactions = this.convertToGraphData(transactionStatsMDB, 'U');
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
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query, req.user);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getUserStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_CONSUMPTION);
      // Convert
      const transactions = this.convertToGraphData(transactionStatsMDB, 'U');
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
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query, req.user);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_USAGE);
      // Convert
      const transactions = this.convertToGraphData(transactionStatsMDB, 'C');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetCurrentMetrics(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = StatisticSecurity.filterMetricsStatisticsRequest(req.query, req.user);
      // Get Data
      const metrics = await StatisticsStorage.getCurrentMetrics(req.user.tenantID, filteredRequest);
      // Return
      res.json(metrics);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetChargingStationConsumptionStatistics(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query, req.user);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_CONSUMPTION);
      // Convert
      const transactions = this.convertToGraphData(transactionStatsMDB, 'C');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetStatisticsExport(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_TRANSACTIONS,
          null, 560,
          'StatisticsService', 'handleGetStatisticsExport',
          req.user);
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterExportStatisticsRequest(req.query, req.user);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Decisions
      let groupBy: string;
      switch (filteredRequest.DataType) {
        case 'Consumption':
          groupBy = Constants.STATS_GROUP_BY_CONSUMPTION;
          break;
        default:
          groupBy = Constants.STATS_GROUP_BY_USAGE;
      }
      let method: string;
      if (filteredRequest.DataCategory === 'C') {
        method = 'getChargingStationStats';
      } else {
        method = 'getUserStats';
      }

      // Query data
      const transactionStatsMDB = await StatisticsStorage[method](req.user.tenantID, filter, groupBy);

      // Build the result
      const filename = 'export' + filteredRequest.DataType + 'Statistics.csv';
      fs.writeFile(filename, this.convertToCSV(transactionStatsMDB, filteredRequest.DataCategory,
        filteredRequest.DataType, filteredRequest.Year, filteredRequest.DataScope), (createError) => {
        if (createError) {
          throw createError;
        }
        res.download(filename, (downloadError) => {
          if (downloadError) {
            throw downloadError;
          }
          fs.unlink(filename, (unlinkError) => {
            if (unlinkError) {
              throw unlinkError;
            }
          });
        });
      });
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static buildFilter(filteredRequest, loggedUser) {
    // Only completed transactions
    const filter: any = { stop: { $exists: true } };
    // Date
    if ('Year' in filteredRequest) {
      if (filteredRequest.Year > 0) {
        filter.startDateTime = moment().year(filteredRequest.Year).startOf('year').toDate().toISOString();
        filter.endDateTime = moment().year(filteredRequest.Year).endOf('year').toDate().toISOString();
      }
    } else {
      // Current year
      filter.startDateTime = moment().startOf('year').toDate().toISOString();
      filter.endDateTime = moment().endOf('year').toDate().toISOString();
    }
    // Site
    if (filteredRequest.SiteID) {
      filter.siteID = filteredRequest.SiteID;
    }
    // Site Area
    if (filteredRequest.SiteAreaID) {
      filter.siteAreaID = filteredRequest.SiteAreaID;
    }
    // Charge Box
    if (filteredRequest.ChargeBoxID) {
      filter.chargeBoxID = filteredRequest.ChargeBoxID;
    }
    // User
    if (Authorizations.isBasic(loggedUser)) {
      // Only for current user
      filter.userID = loggedUser.id;
    } else if (!Authorizations.isBasic(loggedUser) && filteredRequest.UserID) {
      filter.userID = filteredRequest.UserID;
    }
    return filter;
  }

  static convertToGraphData(transactionStatsMDB: any[], dataCategory: string) {
    const transactions = [];
    // Create
    if (transactionStatsMDB && transactionStatsMDB.length > 0) {
      // Create
      let month = -1;
      let transaction;
      for (const transactionStatMDB of transactionStatsMDB) {
        // Init
        if (month !== transactionStatMDB._id.month) {
          // Set
          month = transactionStatMDB._id.month;
          // Create new
          transaction = {};
          transaction.month = transactionStatMDB._id.month - 1;
          // Add
          if (transaction) {
            transactions.push(transaction);
          }
        }
        // Set key figure (total)
        if (dataCategory === 'C') {
          transaction[transactionStatMDB._id.chargeBox] = transactionStatMDB.total;
        } else {
          transaction[Utils.buildUserFullName(transactionStatMDB.user, false, false, true)] = transactionStatMDB.total;
        }
      }
    }
    return transactions;
  }

  static convertToCSV(transactionStatsMDB: any[], dataCategory, dataType, year, dataScope?) {
    let csv: string;
    let index: number;
    let transaction: any;
    const transactions = [];
    switch (dataType) {
      case 'Consumption':
        if (dataCategory === 'C') {
          csv = 'year,month,chargeBoxId,consumptionKwH\r\n';
        } else {
          csv = 'year,month,userName,firstName,consumptionKwH\r\n';
        }
        break;
      default:
        if (dataCategory === 'C') {
          csv = 'year,month,chargeBoxId,usageHours\r\n';
        } else {
          csv = 'year,month,userName,firstName,usageHours\r\n';
        }
    }
    if (transactionStatsMDB && transactionStatsMDB.length > 0) {
      for (const transactionStatMDB of transactionStatsMDB) {
        transaction = transactionStatMDB;
        if (dataCategory !== 'C') {
          if (!transaction.user) {
            transaction.user = { 'name': 'Unknown', 'firstName': ' ' };
          }
          if (!transaction.user.name) {
            transaction.user.name = 'Unknown';
          }
          if (!transaction.user.firstName) {
            transaction.user.firstName = ' ';
          }
        }
        if (!year || year == "0" || (dataScope && dataScope !== 'month')) {
          transaction._id.month = 0;
          index = -1;
          if (transactions && transactions.length > 0) {
            if (dataCategory === 'C') {
              index = transactions.findIndex((record) => {
                return (record._id.chargeBox === transaction._id.chargeBox);
              });
            } else {
              index = transactions.findIndex((record) => {
                return ((record.user.name === transaction.user.name)
                  && (record.user.firstName === transaction.user.firstName));
              });
            }
          }
          if (index < 0) {
            transactions.push(transaction);
          } else {
            transactions[index].total += transaction.total;
          }
        } else {
          transactions.push(transaction);
        }
      }

      for (transaction of transactions) {
        csv += `${year ? year : '0000'},`;
        csv += `${transaction._id.month},`;
        csv += (dataCategory === 'C') ? `${transaction._id.chargeBox},` :
          `${transaction.user.name}, ${transaction.user.firstName},`;
        csv += `${transaction.total}\r\n`;
      }
    }
    return csv;
  }
}
