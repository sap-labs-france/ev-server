import StatisticFilter, { ChargingStationStats, StatsAggregationKey, StatsDataScope, StatsGroupBy, UserStats } from '../../types/Statistic';

import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'StatisticsStorage';

export default class StatisticsStorage {

  public static async getChargingStationStats(tenant: Tenant, params: StatisticFilter, groupBy: string): Promise<ChargingStationStats[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Build filter
    const filters: any = {};
    // Date provided?
    if (params.startDateTime || params.endDateTime) {
      filters.timestamp = {};
    }
    // Start date
    if (params.startDateTime) {
      filters.timestamp.$gte = Utils.convertToDate(params.startDateTime);
    }
    // End date
    if (params.endDateTime) {
      filters.timestamp.$lte = Utils.convertToDate(params.endDateTime);
    }
    // Check stop transaction
    if (params.stop) {
      filters.stop = params.stop;
    }
    // Site
    if (!Utils.isEmptyArray(params.siteIDs)) {
      filters.siteID = {
        $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
      };
    }
    // Filter on Site Area?
    if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters.siteAreaID = {
        $in: params.siteAreaIDs.map((siteAreaID) => DatabaseUtils.convertToObjectID(siteAreaID))
      };
    }
    // Filter on Charge Box?
    if (!Utils.isEmptyArray(params.chargeBoxIDs)) {
      filters.chargeBoxID = {
        $in: params.chargeBoxIDs.map((chargeBoxID) => chargeBoxID)
      };
    }
    // Filter on User?
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.userID = {
        $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID))
      };
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: filters
    });

    const scope: StatsDataScope = params.dataScope;
    const createGroupId = (unit = '') => {
      if (scope === StatsDataScope.DATE) {
        return { chargeBox: '$chargeBoxID', [StatsDataScope.DATE]: { '$dateToString': { date: '$timestamp', format: '%Y-%m-%d' } }, unit };
      }
      const key: StatsAggregationKey = `$${scope}`;
      return { chargeBox: '$chargeBoxID', [scope]: { [key]: '$timestamp' }, unit };
    };

    // Group
    switch (groupBy) {
      // By Consumption
      case StatsGroupBy.CONSUMPTION:
        aggregation.push({
          $group: {
            _id: createGroupId(),
            total: { $sum: { $divide: ['$stop.totalConsumptionWh', 1000] } }
          }
        });
        break;
      // By Usage
      case StatsGroupBy.USAGE:
        aggregation.push({
          $group: {
            _id: createGroupId(),
            total: { $sum: { $divide: [{ $subtract: ['$stop.timestamp', '$timestamp'] }, 60 * 60 * 1000] } }
          }
        });
        break;
      // By Inactivity
      case StatsGroupBy.INACTIVITY:
        aggregation.push({
          $group: {
            _id: createGroupId(),
            total: { $sum: { $divide: [{ $add: ['$stop.totalInactivitySecs', '$stop.extraInactivitySecs'] }, 60 * 60] } }
          }
        });
        break;
      // By Transactions
      case StatsGroupBy.TRANSACTIONS:
        aggregation.push({
          $group: {
            _id: createGroupId(),
            total: { $sum: 1 }
          }
        });
        break;
      // By Pricing
      case StatsGroupBy.PRICING:
        aggregation.push({
          $group: {
            _id: createGroupId('$stop.priceUnit'),
            total: { $sum: '$stop.price' }
          }
        });
        break;
    }
    // Replace root
    aggregation.push({
      $replaceRoot: {
        newRoot: { [scope]: `$_id.${scope}`, unit: '$_id.unit', chargeBox: '$_id.chargeBox', total: '$total' }
      }
    });
    // Sort
    aggregation.push({
      $sort: { [scope]: 1, 'unit': 1, 'chargeBox': 1 }
    });
    // Read DB
    const chargingStationStatsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as ChargingStationStats[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getChargingStationStats', startTime, aggregation, chargingStationStatsMDB);
    return chargingStationStatsMDB;
  }

  public static async getUserStats(tenant: Tenant, params: StatisticFilter, groupBy: string): Promise<UserStats[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Build filter
    const filters: any = {};
    // Date provided?
    if (params.startDateTime || params.endDateTime) {
      filters.timestamp = {};
    }
    // Start date
    if (params.startDateTime) {
      filters.timestamp.$gte = Utils.convertToDate(params.startDateTime);
    }
    // End date
    if (params.endDateTime) {
      filters.timestamp.$lte = Utils.convertToDate(params.endDateTime);
    }
    // Check stop tr
    if (params.stop) {
      filters.stop = params.stop;
    }
    // Filter on Site?
    if (!Utils.isEmptyArray(params.siteIDs)) {
      filters.siteID = {
        $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
      };
    }
    // Filter on Site Area?
    if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters.siteAreaID = {
        $in: params.siteAreaIDs.map((siteAreaID) => DatabaseUtils.convertToObjectID(siteAreaID))
      };
    }
    // Filter on Charge Box?
    if (!Utils.isEmptyArray(params.chargeBoxIDs)) {
      filters.chargeBoxID = {
        $in: params.chargeBoxIDs.map((chargeBoxID) => chargeBoxID)
      };
    }
    // Filter on User?
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.userID = {
        $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID))
      };
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: filters
    });
    // Group
    switch (groupBy) {
      // By Consumption
      case StatsGroupBy.CONSUMPTION:
        aggregation.push({
          $group: {
            // _id: { userID: "$userID", year: { $year: "$timestamp" }, month: { $month: "$timestamp" }, unit: '' },
            _id: { userID: '$userID', month: { $month: '$timestamp' }, unit: '' },
            total: { $sum: { $divide: ['$stop.totalConsumptionWh', 1000] } }
          }
        });
        break;
      // By Usage
      case StatsGroupBy.USAGE:
        aggregation.push({
          $group: {
            _id: { userID: '$userID', month: { $month: '$timestamp' }, unit: '' },
            total: { $sum: { $divide: [{ $subtract: ['$stop.timestamp', '$timestamp'] }, 60 * 60 * 1000] } }
          }
        });
        break;
      // By Inactivity
      case StatsGroupBy.INACTIVITY:
        aggregation.push({
          $group: {
            _id: { userID: '$userID', month: { $month: '$timestamp' }, unit: '' },
            total: { $sum: { $divide: [{ $add: ['$stop.totalInactivitySecs', '$stop.extraInactivitySecs'] }, 60 * 60] } }
          }
        });
        break;
      // By Transactions
      case StatsGroupBy.TRANSACTIONS:
        aggregation.push({
          $group: {
            _id: { userID: '$userID', month: { $month: '$timestamp' }, unit: '' },
            total: { $sum: 1 }
          }
        });
        break;
      // By Pricing
      case StatsGroupBy.PRICING:
        aggregation.push({
          $group: {
            _id: { userID: '$userID', month: { $month: '$timestamp' }, unit: '$stop.priceUnit' },
            total: { $sum: '$stop.price' }
          }
        });
        break;
    }
    // Lookup for users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID: tenant.id, aggregation, localField: '_id.userID', foreignField: '_id',
      asField: 'user', oneToOneCardinality: true, oneToOneCardinalityNotNull: true
    }, [ { $project: { _id: 1, name: 1, firstName: 1 } } ]);
    // Single Record
    aggregation.push({
      $unwind: { 'path': '$user', 'preserveNullAndEmptyArrays': true }
    });
    // Replace root
    aggregation.push({
      $replaceRoot: {
        newRoot: { month: '$_id.month', unit: '$_id.unit', user: '$user', total: '$total' }
      }
    });
    // Sort
    aggregation.push({
      $sort: { 'month': 1, 'unit': 1, 'userID': 1 } // Instead of chargeBox userID ?
    });
    // Read DB
    const userStatsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as UserStats[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getUserStats', startTime, aggregation, userStatsMDB);
    return userStatsMDB;
  }
}
