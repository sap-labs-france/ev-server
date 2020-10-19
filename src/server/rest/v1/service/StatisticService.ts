import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';
import StatisticFilter, { StatsGroupBy } from '../../../../types/Statistic';

import AppAuthError from '../../../../exception/AppAuthError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import HttpStatisticsRequest from '../../../../types/requests/HttpStatisticRequest';
import { ServerAction } from '../../../../types/Server';
import StatisticSecurity from './security/StatisticSecurity';
import StatisticsStorage from '../../../../storage/mongodb/StatisticsStorage';
import TenantComponents from '../../../../types/TenantComponents';
import User from '../../../../types/User';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment';

const MODULE_NAME = 'StatisticService';

export default class StatisticService {
  static async handleGetChargingStationConsumptionStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetChargingStationConsumptionStatistics');
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetChargingStationConsumptionStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
      req.user.tenantID, filter, StatsGroupBy.CONSUMPTION);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'C');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationUsageStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetChargingStationUsageStatistics');
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetChargingStationUsageStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
      req.user.tenantID, filter, StatsGroupBy.USAGE);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'C');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationInactivityStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetChargingStationInactivityStatistics');
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetChargingStationInactivityStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
      req.user.tenantID, filter, StatsGroupBy.INACTIVITY);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'C');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationTransactionsStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetChargingStationTransactionsStatistics');
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetChargingStationTransactionsStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
      req.user.tenantID, filter, StatsGroupBy.TRANSACTIONS);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'C');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationPricingStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetChargingStationPricingStatistics');
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetChargingStationPricingStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStatsMDB = await StatisticsStorage.getChargingStationStats(
      req.user.tenantID, filter, StatsGroupBy.PRICING);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'C');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetUserConsumptionStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetUserConsumptionStatistics');
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetUserConsumptionStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStatsMDB = await StatisticsStorage.getUserStats(
      req.user.tenantID, filter, StatsGroupBy.CONSUMPTION);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'U');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetUserUsageStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetUserUsageStatistics');
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetUserUsageStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStatsMDB = await StatisticsStorage.getUserStats(
      req.user.tenantID, filter, StatsGroupBy.USAGE);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'U');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetUserInactivityStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetUserInactivityStatistics');
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetUserInactivityStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStatsMDB = await StatisticsStorage.getUserStats(
      req.user.tenantID, filter, StatsGroupBy.INACTIVITY);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'U');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetUserTransactionsStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetUserTransactionsStatistics');
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetUserTransactionsStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStatsMDB = await StatisticsStorage.getUserStats(
      req.user.tenantID, filter, StatsGroupBy.TRANSACTIONS);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'U');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetUserPricingStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetUserPricingStatistics');
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleGetUserPricingStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticSecurity.filterStatisticsRequest(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStatsMDB = await StatisticsStorage.getUserStats(
      req.user.tenantID, filter, StatsGroupBy.PRICING);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStatsMDB, 'U');
    // Return
    res.json(transactions);
    next();
  }

  static async handleExportStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleExportStatistics');
    // Check auth
    if (!Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTIONS,
        module: MODULE_NAME,
        method: 'handleExportStatistics'
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
        groupBy = StatsGroupBy.CONSUMPTION;
        break;
      case 'Usage':
        groupBy = StatsGroupBy.USAGE;
        break;
      case 'Inactivity':
        groupBy = StatsGroupBy.INACTIVITY;
        break;
      case 'Transactions':
        groupBy = StatsGroupBy.TRANSACTIONS;
        break;
      case 'Pricing':
        groupBy = StatsGroupBy.PRICING;
        break;
      default:
        groupBy = StatsGroupBy.CONSUMPTION;
    }
    let method: string;
    if (filteredRequest.DataCategory === 'C') {
      method = 'getChargingStationStats';
    } else {
      method = 'getUserStats';
    }
    // Query data
    const transactionStatsMDB = await StatisticsStorage[method](req.user.tenantID, filter, groupBy);
    // Set the attachement name
    res.attachment('exported-' + filteredRequest.DataType.toLowerCase() + '-statistics.csv');
    // Build the result
    const dataToExport = StatisticService.convertToCSV(req.user, transactionStatsMDB, filteredRequest.DataCategory,
      filteredRequest.DataType, filteredRequest.Year, filteredRequest.DataScope);
    // Send
    res.write(dataToExport);
    // End of stream
    res.end();
  }

  // Only completed transactions
  static buildFilter(filteredRequest: HttpStatisticsRequest, loggedUser: UserToken): StatisticFilter {
    const filter: StatisticFilter = { stop: { $exists: true } };
    // Date
    if ('Year' in filteredRequest) {
      if (filteredRequest.Year > 0) {
        filter.startDateTime = moment().year(filteredRequest.Year).startOf('year').toDate();
        filter.endDateTime = moment().year(filteredRequest.Year).endOf('year').toDate();
      }
    } else {
      // Current year
      filter.startDateTime = moment().startOf('year').toDate();
      filter.endDateTime = moment().endOf('year').toDate();
    }
    // DateFrom
    if (filteredRequest.StartDateTime) {
      filter.startDateTime = filteredRequest.StartDateTime;
    }
    // DateUntil
    if (filteredRequest.EndDateTime) {
      filter.endDateTime = filteredRequest.EndDateTime;
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
          userName = Utils.buildUserFullName(transactionStatMDB.user, false, false);
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

  static convertToCSV(loggedUser: UserToken, transactionStatsMDB: any[], dataCategory: string, dataType: string, year: number | string, dataScope?: string): string {
    let user: User;
    let unknownUser = Utils.buildUserFullName(user, false, false);
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
            csv += number.toString() + Constants.CSV_SEPARATOR + `${transaction._id.unit}` + '\r\n';
          } else {
            csv += number.toString() + Constants.CSV_SEPARATOR + ' ' + '\r\n';
          }
        } else {
          csv += number.toString() + '\r\n';
        }
      }
    }
    return csv;
  }
}
