/* eslint-disable */
import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';
import StatisticFilter, { ChargingStationStats, StatsDataCategory, StatsDataScope, StatsDataType, StatsGroupBy, UserStats } from '../../../../types/Statistic';

import AppAuthError from '../../../../exception/AppAuthError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import HttpStatisticsGetRequest from '../../../../types/requests/HttpStatisticRequest';
import { ServerAction } from '../../../../types/Server';
import StatisticsStorage from '../../../../storage/mongodb/StatisticsStorage';
import StatisticsValidatorRest from '../validator/StatisticsValidatorRest';
import { TenantComponents } from '../../../../types/Tenant';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import moment from 'moment';

const MODULE_NAME = 'StatisticService';

export default class StatisticService {
  static async handleGetChargingStationConsumptionStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetChargingStationConsumptionStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST, entity: Entity.TRANSACTION,
        module: MODULE_NAME, method: 'handleGetChargingStationConsumptionStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticsValidatorRest.getInstance().validateStatisticsGet(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStats = await StatisticsStorage.getChargingStationStats(
      req.tenant, filter, StatsGroupBy.CONSUMPTION);
    // Convert
    const transactions = StatisticService.convertToGraphData(
      transactionStats, StatsDataCategory.CHARGING_STATION, filter.dataScope);
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationUsageStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetChargingStationUsageStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetChargingStationUsageStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticsValidatorRest.getInstance().validateStatisticsGet(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStats = await StatisticsStorage.getChargingStationStats(
      req.tenant, filter, StatsGroupBy.USAGE);
    // Convert
    const transactions = StatisticService.convertToGraphData(
      transactionStats, StatsDataCategory.CHARGING_STATION, filter.dataScope);
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationInactivityStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetChargingStationInactivityStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetChargingStationInactivityStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticsValidatorRest.getInstance().validateStatisticsGet(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStats = await StatisticsStorage.getChargingStationStats(
      req.tenant, filter, StatsGroupBy.INACTIVITY);
    // Convert
    const transactions = StatisticService.convertToGraphData(
      transactionStats, StatsDataCategory.CHARGING_STATION, filter.dataScope);
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationTransactionsStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetChargingStationTransactionsStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetChargingStationTransactionsStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticsValidatorRest.getInstance().validateStatisticsGet(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStats = await StatisticsStorage.getChargingStationStats(
      req.tenant, filter, StatsGroupBy.TRANSACTIONS);
    // Convert
    const transactions = StatisticService.convertToGraphData(
      transactionStats, StatsDataCategory.CHARGING_STATION, filter.dataScope);
    res.json(transactions);
    next();
  }

  static async handleGetChargingStationPricingStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetChargingStationPricingStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetChargingStationPricingStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticsValidatorRest.getInstance().validateStatisticsGet(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStats = await StatisticsStorage.getChargingStationStats(
      req.tenant, filter, StatsGroupBy.PRICING);
    // Convert
    const transactions = StatisticService.convertToGraphData(
      transactionStats, StatsDataCategory.CHARGING_STATION, filter.dataScope);
    res.json(transactions);
    next();
  }

  static async handleGetUserConsumptionStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetUserConsumptionStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetUserConsumptionStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticsValidatorRest.getInstance().validateStatisticsGet(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStats = await StatisticsStorage.getUserStats(
      req.tenant, filter, StatsGroupBy.CONSUMPTION);
    // Convert
    const transactions = StatisticService.convertToGraphData(
      transactionStats, StatsDataCategory.USER);
    res.json(transactions);
    next();
  }

  static async handleGetUserUsageStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetUserUsageStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetUserUsageStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticsValidatorRest.getInstance().validateStatisticsGet(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStats = await StatisticsStorage.getUserStats(
      req.tenant, filter, StatsGroupBy.USAGE);
    // Convert
    const transactions = StatisticService.convertToGraphData(
      transactionStats, StatsDataCategory.USER);
    res.json(transactions);
    next();
  }

  static async handleGetUserInactivityStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetUserInactivityStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetUserInactivityStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticsValidatorRest.getInstance().validateStatisticsGet(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStats = await StatisticsStorage.getUserStats(
      req.tenant, filter, StatsGroupBy.INACTIVITY);
    // Convert
    const transactions = StatisticService.convertToGraphData(
      transactionStats, StatsDataCategory.USER);
    res.json(transactions);
    next();
  }

  static async handleGetUserTransactionsStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetUserTransactionsStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetUserTransactionsStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticsValidatorRest.getInstance().validateStatisticsGet(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStats = await StatisticsStorage.getUserStats(
      req.tenant, filter, StatsGroupBy.TRANSACTIONS);
    // Convert
    const transactions = StatisticService.convertToGraphData(
      transactionStats, StatsDataCategory.USER);
    res.json(transactions);
    next();
  }

  static async handleGetUserPricingStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleGetUserPricingStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleGetUserPricingStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticsValidatorRest.getInstance().validateStatisticsGet(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Get Stats
    const transactionStats = await StatisticsStorage.getUserStats(
      req.tenant, filter, StatsGroupBy.PRICING);
    // Convert
    const transactions = StatisticService.convertToGraphData(
      transactionStats, StatsDataCategory.USER);
    res.json(transactions);
    next();
  }

  static async handleExportStatistics(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.STATISTICS,
      Action.LIST, Entity.TRANSACTION, MODULE_NAME, 'handleExportStatistics');
    // Check auth
    if (!await Authorizations.canListTransactions(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.LIST,
        entity: Entity.TRANSACTION,
        module: MODULE_NAME,
        method: 'handleExportStatistics'
      });
    }
    // Filter
    const filteredRequest = StatisticsValidatorRest.getInstance().validateStatisticsExport(req.query);
    // Build filter
    const filter = StatisticService.buildFilter(filteredRequest, req.user);
    // Decisions
    let groupBy: string;
    switch (filteredRequest.DataType) {
      case StatsDataType.CONSUMPTION:
        groupBy = StatsGroupBy.CONSUMPTION;
        break;
      case StatsDataType.USAGE:
        groupBy = StatsGroupBy.USAGE;
        break;
      case StatsDataType.INACTIVITY:
        groupBy = StatsGroupBy.INACTIVITY;
        break;
      case StatsDataType.TRANSACTION:
        groupBy = StatsGroupBy.TRANSACTIONS;
        break;
      case StatsDataType.PRICING:
        groupBy = StatsGroupBy.PRICING;
        break;
      default:
        groupBy = StatsGroupBy.CONSUMPTION;
    }
    // Query data
    let transactionStats: ChargingStationStats[] | UserStats[];
    if (filteredRequest.DataCategory === StatsDataCategory.CHARGING_STATION) {
      transactionStats = await StatisticsStorage.getChargingStationStats(req.tenant, filter, groupBy);
    } else {
      transactionStats = await StatisticsStorage.getUserStats(req.tenant, filter, groupBy);
    }
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
  static buildFilter(filteredRequest: HttpStatisticsGetRequest, loggedUser: UserToken): StatisticFilter {
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
    if (filteredRequest.SiteID) {
      filter.siteIDs = filteredRequest.SiteID.split('|');
    }
    // Site Area
    if (filteredRequest.SiteAreaID) {
      filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
    }
    // Charge Box
    if (filteredRequest.ChargingStationID) {
      filter.chargeBoxIDs = filteredRequest.ChargingStationID.split('|');
    }
    // DataScope
    if (filteredRequest.DataScope === StatsDataScope.TOTAL || !filteredRequest.DataScope) {
      filter.dataScope = StatsDataScope.MONTH;
    } else {
      filter.dataScope = filteredRequest.DataScope;
    }
    // User
    if (Authorizations.isBasic(loggedUser)) {
      if (Authorizations.isSiteAdmin(loggedUser)) {
        if (filteredRequest.UserID) {
          filter.userIDs = filteredRequest.UserID.split('|');
        } else if (filteredRequest.SiteID) {
          filter.siteIDs = filteredRequest.SiteID.split('|');
        } else {
          // Only for current sites
          filter.siteIDs = loggedUser.sitesAdmin;
        }
      } else {
        // Only for current user
        filter.userIDs = [loggedUser.id];
      }
    } else if (!Authorizations.isBasic(loggedUser) && filteredRequest.UserID) {
      filter.userIDs = filteredRequest.UserID.split('|');
    }
    return filter;
  }

  static convertToGraphData(transactionStats: ChargingStationStats[] | UserStats[], dataCategory: string, dataScope: StatsDataScope = StatsDataScope.MONTH): any[] {
    const transactions: Record<string, number>[] = [];
    // Create
    if (transactionStats && transactionStats.length > 0) {
      // Create
      let period = -1;
      let unit: string;
      let transaction;
      let userName: string;
      for (const transactionStat of transactionStats) {
        const stat = transactionStat[dataScope];
        // Init
        if (transactionStat.unit && (unit !== transactionStat.unit)) {
          // Set
          period = stat;
          unit = transactionStat.unit;
          // Create new
          transaction = {};
          transaction[dataScope] = typeof stat === 'number' ? stat - 1 : stat;
          transaction.unit = transactionStat.unit;
          // Add
          if (transaction) {
            transactions.push(transaction);
          }
        }
        if (period !== stat) {
          // Set
          period = stat;
          // Create new
          transaction = {};
          transaction[dataScope] = typeof stat === 'number' ? stat - 1 : stat;
          if (transactionStat.unit) {
            unit = transactionStat.unit;
            transaction.unit = transactionStat.unit;
          }
          // Add
          if (transaction) {
            transactions.push(transaction);
          }
        }
        // Set key figure (total)
        if (dataCategory === StatsDataCategory.CHARGING_STATION) {
          const chargingStationStats = transactionStat as ChargingStationStats;
          transaction[chargingStationStats.chargeBox] = chargingStationStats.total;
        } else {
          const userStats = transactionStat as UserStats;
          // We can have duplicate user names, like 'Unknown'
          userName = Utils.buildUserFullName(userStats.user, false, false);
          if (userName in transaction) {
            transaction[userName] += userStats.total;
          } else {
            transaction[userName] = userStats.total;
          }
        }
      }
    }
    return transactions;
  }

  static getPricingCell(transaction: ChargingStationStats | UserStats, numberOfTransactions: number): string[] {
    if (transaction.unit) {
      return [numberOfTransactions.toString(), transaction.unit];
    }
    return [numberOfTransactions.toString(), ' '];
  }

  // Build header row
  static getYearAndMonthCells(year: number | string, dataScope?: StatsDataScope): string {
    if (year && year !== '0') {
      const yearHeader = StatsDataScope.YEAR;
      if (dataScope === StatsDataScope.MONTH) {
        return [yearHeader, StatsDataScope.MONTH].join(Constants.CSV_SEPARATOR);
      }
      return yearHeader;
    }
  }

  // Build dataType cells
  static getDataTypeCells = (dataType: StatsDataType): string => {
    switch (dataType) {
      case StatsDataType.CONSUMPTION:
        return 'consumption';
      case StatsDataType.USAGE:
        return 'usage';
      case StatsDataType.INACTIVITY:
        return 'inactivity';
      case StatsDataType.TRANSACTION:
        return 'numberOfSessions';
      case StatsDataType.PRICING:
        return ['price', 'priceUnit'].join(Constants.CSV_SEPARATOR);
      default:
        return '';
    }
  };

  static convertToCSV(transactionStats: ChargingStationStats[] | UserStats[],
    dataCategory: StatsDataCategory, dataType: StatsDataType, year: number | string, dataScope?: StatsDataScope): string {
    const headers = [
      dataCategory === StatsDataCategory.CHARGING_STATION ? 'chargingStation' : 'user',
      StatisticService.getYearAndMonthCells(year, dataScope),
      StatisticService.getDataTypeCells(dataType)
    ];
    let index: number;
    const transactions = [];
    if (transactionStats && transactionStats.length > 0) {
      for (const transactionStat of transactionStats) {
        if (!year || year === '0' || !dataScope || (dataScope && dataScope !== StatsDataScope.MONTH)) {
          // Annual or overall values
          transactionStat.month = 0;
          index = -1;
          if (transactions && transactions.length > 0) {
            if (dataCategory === StatsDataCategory.CHARGING_STATION) {
              const chargingStationStats = transactionStat as ChargingStationStats;
              index = transactions.findIndex((record) => {
                if (!record.unit || !transactionStat.unit) {
                  return (record.chargeBox === chargingStationStats.chargeBox);
                }
                return ((record.chargeBox === chargingStationStats.chargeBox)
                  && (record.unit === chargingStationStats.unit));
              });
            } else {
              const userStats = transactionStat as UserStats;
              index = transactions.findIndex((record) => {
                if (!record.unit || !userStats.unit) {
                  return ((record.user.name === userStats.user.name)
                    && (record.user.firstName === userStats.user.firstName));
                }
                return ((record.user.name === userStats.user.name)
                  && (record.user.firstName === userStats.user.firstName)
                  && (record.unit === userStats.unit));
              });
            }
          }
          if (index < 0) {
            transactions.push(transactionStat);
          } else {
            transactions[index].total += transactionStat.total;
          }
        } else if (dataCategory === StatsDataCategory.CHARGING_STATION) {
          const chargingStationStats = transactionStat as ChargingStationStats;
          transactions.push(chargingStationStats);
        } else {
          const userStats = transactionStat as UserStats;
          // Treat duplicate names (like 'Unknown')
          index = transactions.findIndex((record) => {
            if (!record.unit || !userStats.unit) {
              return ((record.month === userStats.month)
                && (record.user.name === userStats.user.name)
                && (record.user.firstName === userStats.user.firstName));
            }
            return ((record.month === userStats.month)
              && (record.user.name === userStats.user.name)
              && (record.user.firstName === userStats.user.firstName)
              && (record.unit === userStats.unit));
          });
          if (index < 0) {
            transactions.push(userStats);
          } else {
            transactions[index].total += userStats.total;
          }
        }
      }
      if (dataCategory === StatsDataCategory.CHARGING_STATION) {
        // Sort by Charging Station and month
        transactions.sort((rec1, rec2) => {
          if (rec1.chargeBox > rec2.chargeBox) {
            return 1;
          }
          if (rec1.chargeBox < rec2.chargeBox) {
            return -1;
          }
          // Charging Station is the same, now compare month
          if (rec1.month > rec2.month) {
            return 1;
          }
          if (rec1.month < rec2.month) {
            return -1;
          }
          if (rec1.unit && rec2.unit) {
            if (rec1.unit > rec2.unit) {
              return 1;
            }
            if (rec1.unit < rec2.unit) {
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
          if (rec1.month > rec2.month) {
            return 1;
          }
          if (rec1.month < rec2.month) {
            return -1;
          }
          if (rec1.unit && rec2.unit) {
            if (rec1.unit > rec2.unit) {
              return 1;
            }
            if (rec1.unit < rec2.unit) {
              return -1;
            }
          }
          return 0;
        });
      }
      // Now build the export file
      let numberOfTransactions: number;
      const rows = transactions.map((transaction) => {
        numberOfTransactions = Utils.truncTo(transaction.total, 2);
        // Use raw numbers - it makes no sense to format numbers here,
        // anyway only locale 'en-US' is supported here as could be seen by:
        // const supportedLocales = Intl.NumberFormat.supportedLocalesOf(['fr-FR', 'en-US', 'de-DE']);
        const row = [
          dataCategory === StatsDataCategory.CHARGING_STATION ? transaction.chargeBox : Utils.buildUserFullName(transaction.user, false),
          year && year !== '0' ? year : '',
          transaction.month > 0 ? transaction.month : '',
          dataType === StatsDataType.PRICING ? StatisticService.getPricingCell(transaction, numberOfTransactions) : numberOfTransactions.toString()
        ].map((value) => Utils.escapeCsvValue(value));
        return row;
      }).join(Constants.CR_LF);
      return [headers, rows].join(Constants.CR_LF);
    }
  }
}
