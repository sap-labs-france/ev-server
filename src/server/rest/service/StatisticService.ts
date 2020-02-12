import { Action, Entity } from '../../../types/Authorization';
import { HTTPAuthError } from '../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import moment from 'moment';
import AppAuthError from '../../../exception/AppAuthError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import StatisticsStorage from '../../../storage/mongodb/StatisticsStorage';
import StatisticSecurity from './security/StatisticSecurity';
import User from '../../../types/User';
import Utils from '../../../utils/Utils';
import UtilsService from './UtilsService';
import UserToken from '../../../types/UserToken';
import I18nManager from '../../../utils/I18nManager';

export default class StatisticService {
  static async handleGetChargingStationConsumptionStatistics(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(
        req.user, Constants.COMPONENTS.STATISTICS,
        Action.LIST, Entity.TRANSACTIONS, 'StatisticService', 'handleGetChargingStationConsumptionStatistics');
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetChargingStationConsumptionStatistics'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_CONSUMPTION);
      // Convert
      const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'C');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetChargingStationUsageStatistics(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(
        req.user, Constants.COMPONENTS.STATISTICS,
        Action.LIST, Entity.TRANSACTIONS, 'StatisticService', 'handleGetChargingStationUsageStatistics');
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetChargingStationUsageStatistics'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_USAGE);
      // Convert
      const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'C');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetChargingStationInactivityStatistics(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(
        req.user, Constants.COMPONENTS.STATISTICS,
        Action.LIST, Entity.TRANSACTIONS, 'StatisticService', 'handleGetChargingStationInactivityStatistics');
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetChargingStationInactivityStatistics'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_INACTIVITY);
      // Convert
      const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'C');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetChargingStationTransactionsStatistics(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(
        req.user, Constants.COMPONENTS.STATISTICS,
        Action.LIST, Entity.TRANSACTIONS, 'StatisticService', 'handleGetChargingStationTransactionsStatistics');
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetChargingStationTransactionsStatistics'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_TRANSACTIONS);
      // Convert
      const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'C');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetChargingStationPricingStatistics(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(
        req.user, Constants.COMPONENTS.STATISTICS,
        Action.LIST, Entity.TRANSACTIONS, 'StatisticService', 'handleGetChargingStationPricingStatistics');
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetChargingStationPricingStatistics'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_PRICING);
      // Convert
      const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'C');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetUserConsumptionStatistics(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(
        req.user, Constants.COMPONENTS.STATISTICS,
        Action.LIST, Entity.TRANSACTIONS, 'StatisticService', 'handleGetUserConsumptionStatistics');
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetUserConsumptionStatistics'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getUserStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_CONSUMPTION);
      // Convert
      const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'U');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetUserUsageStatistics(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(
        req.user, Constants.COMPONENTS.STATISTICS,
        Action.LIST, Entity.TRANSACTIONS, 'StatisticService', 'handleGetUserUsageStatistics');
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetUserUsageStatistics'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getUserStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_USAGE);
      // Convert
      const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'U');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetUserInactivityStatistics(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(
        req.user, Constants.COMPONENTS.STATISTICS,
        Action.LIST, Entity.TRANSACTIONS, 'StatisticService', 'handleGetUserInactivityStatistics');
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetUserInactivityStatistics'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getUserStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_INACTIVITY);
      // Convert
      const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'U');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetUserTransactionsStatistics(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(
        req.user, Constants.COMPONENTS.STATISTICS,
        Action.LIST, Entity.TRANSACTIONS, 'StatisticService', 'handleGetUserTransactionsStatistics');
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetUserTransactionsStatistics'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getUserStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_TRANSACTIONS);
      // Convert
      const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'U');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetUserPricingStatistics(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(
        req.user, Constants.COMPONENTS.STATISTICS,
        Action.LIST, Entity.TRANSACTIONS, 'StatisticService', 'handleGetUserPricingStatistics');
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetUserPricingStatistics'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Get Stats
      const transactionStatsMDB = await StatisticsStorage.getUserStats(
        req.user.tenantID, filter, Constants.STATS_GROUP_BY_PRICING);
      // Convert
      const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'U');
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetCurrentMetrics(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check auth
      if (!Authorizations.canListChargingStations(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetCurrentMetrics'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterMetricsStatisticsRequest(req.query);
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

  static async handleGetStatisticsExport(action: Action, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      UtilsService.assertComponentIsActiveFromToken(
        req.user, Constants.COMPONENTS.STATISTICS,
        Action.LIST, Entity.TRANSACTIONS, 'StatisticService', 'handleGetStatisticsExport');
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: req.user,
          action: Action.LIST,
          entity: Entity.TRANSACTIONS,
          module: 'StatisticService',
          method: 'handleGetStatisticsExport'
        });
      }
      // Filter
      const filteredRequest = StatisticSecurity.filterExportStatisticsRequest(req.query);
      // Build filter
      const filter = StatisticService.buildFilter(filteredRequest, req.user);
      // Decisions
      let groupBy: string;
      switch (filteredRequest.DataType) {
        case 'Consumption':
          groupBy = Constants.STATS_GROUP_BY_CONSUMPTION;
          break;
        case 'Usage':
          groupBy = Constants.STATS_GROUP_BY_USAGE;
          break;
        case 'Inactivity':
          groupBy = Constants.STATS_GROUP_BY_INACTIVITY;
          break;
        case 'Transactions':
          groupBy = Constants.STATS_GROUP_BY_TRANSACTIONS;
          break;
        case 'Pricing':
          groupBy = Constants.STATS_GROUP_BY_PRICING;
          break;
        default:
          groupBy = Constants.STATS_GROUP_BY_CONSUMPTION;
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
      const filename = 'exported-' + filteredRequest.DataType.toLowerCase() + '-statistics.csv';
      fs.writeFile(filename, StatisticService.convertToCSV(req.user, transactionStatsMDB, filteredRequest.DataCategory,
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

  // Only completed transactions
  static buildFilter(filteredRequest, loggedUser) {
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
    // DateFrom
    if (filteredRequest.DateFrom) {
      filter.startDateTime = filteredRequest.DateFrom;
    }
    // DateUntil
    if (filteredRequest.DateUntil) {
      filter.endDateTime = filteredRequest.DateUntil;
    }
    // Site
    if (filteredRequest.SiteIDs) {
      filter.siteIDs = filteredRequest.SiteIDs;
    }
    // Site Area
    if (filteredRequest.SiteAreaIDs) {
      filter.siteAreaIDs = filteredRequest.SiteAreaIDs;
    }
    // Charge Box
    if (filteredRequest.ChargeBoxIDs) {
      filter.chargeBoxIDs = filteredRequest.ChargeBoxIDs;
    }
    // User
    if (Authorizations.isBasic(loggedUser)) {
      // Only for current user
      filter.userIDs = [loggedUser.id];
    } else if (!Authorizations.isBasic(loggedUser) && filteredRequest.UserIDs) {
      filter.userIDs = filteredRequest.UserIDs;
    }
    return filter;
  }

  static convertToGraphData(transactionStatsMDB: any[], dataCategory: string) {
    const transactions = [];
    // Create
    if (transactionStatsMDB && transactionStatsMDB.length > 0) {
      // Create
      let month = -1;
      let unit: string;
      let transaction;
      let userName: string;
      for (const transactionStatMDB of transactionStatsMDB) {
        // Init
        if (transactionStatMDB._id.unit && (unit !== transactionStatMDB._id.unit)) {
          // Set
          month = transactionStatMDB._id.month;
          unit = transactionStatMDB._id.unit;
          // Create new
          transaction = {};
          transaction.month = transactionStatMDB._id.month - 1;
          transaction.unit = transactionStatMDB._id.unit;
          // Add
          if (transaction) {
            transactions.push(transaction);
          }
        }
        if (month !== transactionStatMDB._id.month) {
          // Set
          month = transactionStatMDB._id.month;
          // Create new
          transaction = {};
          transaction.month = transactionStatMDB._id.month - 1;
          if (transactionStatMDB._id.unit) {
            unit = transactionStatMDB._id.unit;
            transaction.unit = transactionStatMDB._id.unit;
          }
          // Add
          if (transaction) {
            transactions.push(transaction);
          }
        }
        // Set key figure (total)
        if (dataCategory === 'C') {
          transaction[transactionStatMDB._id.chargeBox] = transactionStatMDB.total;
        } else {
          // We can have duplicate user names, like 'Unknown'
          userName = Utils.buildUserFullName(transactionStatMDB.user, false, false, true);
          if (userName in transaction) {
            transaction[userName] += transactionStatMDB.total;
          } else {
            transaction[userName] = transactionStatMDB.total;
          }
          // User names are not sorted, but this is not needed for the current charts (separate/different sorting)
        }
      }
    }
    return transactions;
  }

  static convertToCSV(loggedUser: UserToken, transactionStatsMDB: any[], dataCategory: string, dataType: string, year: number | string, dataScope?: string) {
    I18nManager.switchLanguage(loggedUser.language);
    let user: User;
    let unknownUser = Utils.buildUserFullName(user, false, false, true);
    if (!unknownUser) {
      unknownUser = 'Unknown';
    }
    let csv: string;
    if (dataCategory === 'C') {
      csv = 'Charging Station' + Constants.CSV_SEPARATOR;
    } else {
      csv = 'User' + Constants.CSV_SEPARATOR;
    }
    if (year && year !== '0') {
      csv += 'Year' + Constants.CSV_SEPARATOR;
      if (dataScope && dataScope === 'month') {
        csv += 'Month' + Constants.CSV_SEPARATOR;
      }
    }
    switch (dataType) {
      case 'Consumption':
        csv += 'Consumption (kW.h)\r\n';
        break;
      case 'Usage':
        csv += 'Usage (Hours)\r\n';
        break;
      case 'Inactivity':
        csv += 'Inactivity (Hours)\r\n';
        break;
      case 'Transactions':
        csv += 'Number of Sessions\r\n';
        break;
      case 'Pricing':
        csv += 'Price' + Constants.CSV_SEPARATOR + 'Price Unit\r\n';
        break;
      default:
        return csv;
    }
    let index: number;
    let transaction: any;
    const transactions = [];
    if (transactionStatsMDB && transactionStatsMDB.length > 0) {
      for (const transactionStatMDB of transactionStatsMDB) {
        transaction = transactionStatMDB;
        if (dataCategory !== 'C') {
          // Handle missing user data
          if (!transaction.user) {
            transaction.user = { 'name': unknownUser, 'firstName': ' ' };
          }
          if (!transaction.user.name) {
            transaction.user.name = unknownUser;
          }
          if (!transaction.user.firstName) {
            transaction.user.firstName = ' ';
          }
        }
        if (!year || year === '0' || !dataScope || (dataScope && dataScope !== 'month')) {
          // Annual or overall values
          transaction._id.month = 0;
          index = -1;
          if (transactions && transactions.length > 0) {
            if (dataCategory === 'C') {
              index = transactions.findIndex((record) => {
                if (!record._id.unit || !transaction._id.unit) {
                  return (record._id.chargeBox === transaction._id.chargeBox);
                }
                return ((record._id.chargeBox === transaction._id.chargeBox)
                  && (record._id.unit === transaction._id.unit));
              });
            } else {
              index = transactions.findIndex((record) => {
                if (!record._id.unit || !transaction._id.unit) {
                  return ((record.user.name === transaction.user.name)
                    && (record.user.firstName === transaction.user.firstName));
                }
                return ((record.user.name === transaction.user.name)
                  && (record.user.firstName === transaction.user.firstName)
                  && (record._id.unit === transaction._id.unit));
              });
            }
          }
          if (index < 0) {
            transactions.push(transaction);
          } else {
            transactions[index].total += transaction.total;
          }
        } else if (dataCategory === 'C') {
          transactions.push(transaction);
        } else {
          // Treat duplicate names (like 'Unknown')
          index = transactions.findIndex((record) => {
            if (!record._id.unit || !transaction._id.unit) {
              return ((record._id.month === transaction._id.month)
                && (record.user.name === transaction.user.name)
                && (record.user.firstName === transaction.user.firstName));
            }
            return ((record._id.month === transaction._id.month)
              && (record.user.name === transaction.user.name)
              && (record.user.firstName === transaction.user.firstName)
              && (record._id.unit === transaction._id.unit));
          });
          if (index < 0) {
            transactions.push(transaction);
          } else {
            transactions[index].total += transaction.total;
          }
        }
      }
      if (dataCategory === 'C') {
        // Sort by Charging Station and month
        transactions.sort((rec1, rec2) => {
          if (rec1._id.chargeBox > rec2._id.chargeBox) {
            return 1;
          }
          if (rec1._id.chargeBox < rec2._id.chargeBox) {
            return -1;
          }
          // Charging Station is the same, now compare month
          if (rec1._id.month > rec2._id.month) {
            return 1;
          }
          if (rec1._id.month < rec2._id.month) {
            return -1;
          }
          if (rec1._id.unit && rec2._id.unit) {
            if (rec1._id.unit > rec2._id.unit) {
              return 1;
            }
            if (rec1._id.unit < rec2._id.unit) {
              return -1;
            }
          }
          return 0;
        });
      } else {
        // Sort by user name and month
        transactions.sort((rec1, rec2) => {
          if (rec1.user.name > rec2.user.name) {
            return 1;
          }
          if (rec1.user.name < rec2.user.name) {
            return -1;
          }
          if (rec1.user.firstName > rec2.user.firstName) {
            return 1;
          }
          if (rec1.user.firstName < rec2.user.firstName) {
            return -1;
          }
          // Name and first name are identical, now compare month
          if (rec1._id.month > rec2._id.month) {
            return 1;
          }
          if (rec1._id.month < rec2._id.month) {
            return -1;
          }
          if (rec1._id.unit && rec2._id.unit) {
            if (rec1._id.unit > rec2._id.unit) {
              return 1;
            }
            if (rec1._id.unit < rec2._id.unit) {
              return -1;
            }
          }
          return 0;
        });
      }

      // Now build the export file
      let number: number;
      for (transaction of transactions) {
        csv += (dataCategory === 'C') ? `${transaction._id.chargeBox}` + Constants.CSV_SEPARATOR :
          `${Utils.buildUserFullName(transaction.user, false)}` + Constants.CSV_SEPARATOR;
        csv += (year && year !== '0') ? `${year}` + Constants.CSV_SEPARATOR : '';
        csv += (transaction._id.month > 0) ? `${transaction._id.month}` + Constants.CSV_SEPARATOR : '';
        number = Math.round(transaction.total * 100) / 100;
        // Use raw numbers - it makes no sense to format numbers here,
        // anyway only locale 'en-US' is supported here as could be seen by:
        // const supportedLocales = Intl.NumberFormat.supportedLocalesOf(['fr-FR', 'en-US', 'de-DE']);
        if (dataType === 'Pricing') {
          if (transaction._id.unit) {
            csv += number + Constants.CSV_SEPARATOR + `${transaction._id.unit}` + '\r\n';
          } else {
            csv += number + Constants.CSV_SEPARATOR + ' ' + '\r\n';
          }
        } else {
          csv += number + '\r\n';
        }
      }
    }
    return csv;
  }
}
