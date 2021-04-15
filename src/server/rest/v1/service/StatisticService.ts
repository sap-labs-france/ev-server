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
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const transactionStats = await StatisticsStorage.getChargingStationStats(
      req.user.tenantID, filter, StatsGroupBy.CONSUMPTION);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStats, 'C');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationUsageStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetChargingStationUsageStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const transactionStats = await StatisticsStorage.getChargingStationStats(
      req.user.tenantID, filter, StatsGroupBy.USAGE);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStats, 'C');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationInactivityStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetChargingStationInactivityStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const transactionStats = await StatisticsStorage.getChargingStationStats(
      req.user.tenantID, filter, StatsGroupBy.INACTIVITY);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStats, 'C');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationTransactionsStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetChargingStationTransactionsStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const transactionStats = await StatisticsStorage.getChargingStationStats(
      req.user.tenantID, filter, StatsGroupBy.TRANSACTIONS);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStats, 'C');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationPricingStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetChargingStationPricingStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const transactionStats = await StatisticsStorage.getChargingStationStats(
      req.user.tenantID, filter, StatsGroupBy.PRICING);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStats, 'C');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetUserConsumptionStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetUserConsumptionStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const transactionStats = await StatisticsStorage.getUserStats(
      req.user.tenantID, filter, StatsGroupBy.CONSUMPTION);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStats, 'U');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetUserUsageStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetUserUsageStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const transactionStats = await StatisticsStorage.getUserStats(
      req.user.tenantID, filter, StatsGroupBy.USAGE);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStats, 'U');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetUserInactivityStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetUserInactivityStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const transactionStats = await StatisticsStorage.getUserStats(
      req.user.tenantID, filter, StatsGroupBy.INACTIVITY);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStats, 'U');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetUserTransactionsStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetUserTransactionsStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const transactionStats = await StatisticsStorage.getUserStats(
      req.user.tenantID, filter, StatsGroupBy.TRANSACTIONS);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStats, 'U');
    // Return
    res.json(transactions);
    next();
  }

  static async handleGetUserPricingStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleGetUserPricingStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const transactionStats = await StatisticsStorage.getUserStats(
      req.user.tenantID, filter, StatsGroupBy.PRICING);
    // Convert
    const transactions = StatisticService.convertToGraphData(transactionStats, 'U');
    // Return
    res.json(transactions);
    next();
  }

  static async handleExportStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTIONS, MODULE_NAME, 'handleExportStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
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
    const transactionStats = await StatisticsStorage[method](req.user.tenantID, filter, groupBy);
    // Set the attachement name
    res.attachment('exported-' + filteredRequest.DataType.toLowerCase() + '-statistics.csv');
    // Build the result
    const dataToExport = StatisticService.convertToCSV(transactionStats, filteredRequest.DataCategory,
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

  static convertToGraphData(transactionStats: any[], dataCategory: string) {
    const transactions = [];
    // Create
    if (transactionStats && transactionStats.length > 0) {
      // Create
      let month = -1;
      let unit: string;
      let transaction;
      let userName: string;
      for (const transactionStat of transactionStats) {
        // Init
        if (transactionStat._id.unit && (unit !== transactionStat._id.unit)) {
          // Set
          month = transactionStat._id.month;
          unit = transactionStat._id.unit;
          // Create new
          transaction = {};
          transaction.month = transactionStat._id.month - 1;
          transaction.unit = transactionStat._id.unit;
          // Add
          if (transaction) {
            transactions.push(transaction);
          }
        }
        if (month !== transactionStat._id.month) {
          // Set
          month = transactionStat._id.month;
          // Create new
          transaction = {};
          transaction.month = transactionStat._id.month - 1;
          if (transactionStat._id.unit) {
            unit = transactionStat._id.unit;
            transaction.unit = transactionStat._id.unit;
          }
          // Add
          if (transaction) {
            transactions.push(transaction);
          }
        }
        // Set key figure (total)
        if (dataCategory === 'C') {
          transaction[transactionStat._id.chargeBox] = transactionStat.total;
        } else {
          // We can have duplicate user names, like 'Unknown'
          userName = Utils.buildUserFullName(transactionStat.user, false, false);
          if (userName in transaction) {
            transaction[userName] += transactionStat.total;
          } else {
            transaction[userName] = transactionStat.total;
          }
          // User names are not sorted, but this is not needed for the current charts (separate/different sorting)
        }
      }
    }
    return transactions;
  }

  static convertToCSV(transactionStats: any[], dataCategory: string, dataType: string, year: number | string, dataScope?: string): string {
    // Build header row
    const getYearAndMonthCells = (year: number | string, dataScope?: string) : string => {
      if (year && year !== '0') {
        const year = 'year';
        if (dataScope && dataScope === 'month') {
          return [year, 'month'].join(Constants.CSV_SEPARATOR);
        }
        return year;
      }
    }

    const getdataTypeCells = (dataType: string) : string => {
      switch (dataType) {
        case 'Consumption':
          return 'consumption';
        case 'Usage':
          return 'usage';
        case 'Inactivity':
          return 'inactivity'
        case 'Transactions':
          return 'numberOfSessions';
        case 'Pricing':
          return ['price', 'priceUnit'].join(Constants.CSV_SEPARATOR);
        default:
          return '';
      }
    }
    const headers = [
      dataCategory === 'C' ? 'chargingStation' : 'user',
      getYearAndMonthCells(year, dataScope),
      getdataTypeCells(dataType)
    ]
    let index: number;
    const transactions = [];
    if (transactionStats && transactionStats.length > 0) {
      for (const transactionStat of transactionStats) {
        if (!year || year === '0' || !dataScope || (dataScope && dataScope !== 'month')) {
          // Annual or overall values
          transactionStat._id.month = 0;
          index = -1;
          if (transactions && transactions.length > 0) {
            if (dataCategory === 'C') {
              index = transactions.findIndex((record) => {
                if (!record._id.unit || !transactionStat._id.unit) {
                  return (record._id.chargeBox === transactionStat._id.chargeBox);
                }
                return ((record._id.chargeBox === transactionStat._id.chargeBox)
                  && (record._id.unit === transactionStat._id.unit));
              });
            } else {
              index = transactions.findIndex((record) => {
                if (!record._id.unit || !transactionStat._id.unit) {
                  return ((record.user.name === transactionStat.user.name)
                    && (record.user.firstName === transactionStat.user.firstName));
                }
                return ((record.user.name === transactionStat.user.name)
                  && (record.user.firstName === transactionStat.user.firstName)
                  && (record._id.unit === transactionStat._id.unit));
              });
            }
          }
          if (index < 0) {
            transactions.push(transactionStat);
          } else {
            transactions[index].total += transactionStat.total;
          }
        } else if (dataCategory === 'C') {
          transactions.push(transactionStat);
        } else {
          // Treat duplicate names (like 'Unknown')
          index = transactions.findIndex((record) => {
            if (!record._id.unit || !transactionStat._id.unit) {
              return ((record._id.month === transactionStat._id.month)
                && (record.user.name === transactionStat.user.name)
                && (record.user.firstName === transactionStat.user.firstName));
            }
            return ((record._id.month === transactionStat._id.month)
              && (record.user.name === transactionStat.user.name)
              && (record.user.firstName === transactionStat.user.firstName)
              && (record._id.unit === transactionStat._id.unit));
          });
          if (index < 0) {
            transactions.push(transactionStat);
          } else {
            transactions[index].total += transactionStat.total;
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
      const rows = transactions.map((transaction) => {
        number = Utils.truncTo(transaction.total, 2);
        // Use raw numbers - it makes no sense to format numbers here,
        // anyway only locale 'en-US' is supported here as could be seen by:
        // const supportedLocales = Intl.NumberFormat.supportedLocalesOf(['fr-FR', 'en-US', 'de-DE']);
        const row = [
          dataCategory === 'C' ? transaction._id.chargeBox : Utils.buildUserFullName(transaction.user, false),
          year && year !== '0' ? year : '',
          transaction._id.month > 0 ? transaction._id.month : '',
          dataType === 'Pricing' ? getPricingCell(transaction) : number.toString()
        ].map((value) => typeof value === 'string' ? '"' + value.replace('"', '""') + '"' : value);
        return row;
      }).join(Constants.CR_LF);
      // Build pricing cell
      const getPricingCell = (transaction: any) => {
        if (transaction._id.unit) {
          return [number.toString(), transaction._id.unit];
        }
        return [number.toString(), ' '];
      };
      return [headers, rows].join(Constants.CR_LF);
    }
  }
}
