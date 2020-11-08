import StatisticFilter, { StatsGroupBy } from '../../types/Statistic';

import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'StatisticsStorage';

export default class StatisticsStorage {
  static async getChargingStationStats(tenantID: string, filters: StatisticFilter, groupBy: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getChargingStationStats');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const match: any = {};
    // Date provided?
    if (filters.startDateTime || filters.endDateTime) {
      match.timestamp = {};
    }
    // Start date
    if (filters.startDateTime) {
      match.timestamp.$gte = Utils.convertToDate(filters.startDateTime);
    }
    // End date
    if (filters.endDateTime) {
      match.timestamp.$lte = Utils.convertToDate(filters.endDateTime);
    }
    // Check stop transaction
    if (filters.stop) {
      match.stop = filters.stop;
    }
    // Site
    if (!Utils.isEmptyArray(filters.siteIDs)) {
      match.siteID = {
        $in: filters.siteIDs.map((siteID) => Utils.convertToObjectID(siteID))
      };
    }
    // Filter on Site Area?
    if (!Utils.isEmptyArray(filters.siteAreaIDs)) {
      match.siteAreaID = {
        $in: filters.siteAreaIDs.map((siteAreaID) => Utils.convertToObjectID(siteAreaID))
      };
    }
    // Filter on Charge Box?
    if (!Utils.isEmptyArray(filters.chargeBoxIDs)) {
      match.chargeBoxID = {
        $in: filters.chargeBoxIDs.map((chargeBoxID) => chargeBoxID)
      };
    }
    // Filter on User?
    if (!Utils.isEmptyArray(filters.userIDs)) {
      match.userID = {
        $in: filters.userIDs.map((userID) => Utils.convertToObjectID(userID))
      };
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: match
    });
    // Group
    switch (groupBy) {
      // By Consumption
      case StatsGroupBy.CONSUMPTION:
        aggregation.push({
          $group: {
            // _id: { chargeBox: "$chargeBoxID", year: { $year: "$timestamp" }, month: { $month: "$timestamp" }, unit: '' },
            _id: { chargeBox: '$chargeBoxID', month: { $month: '$timestamp' }, unit: '' },
            total: { $sum: { $divide: ['$stop.totalConsumptionWh', 1000] } }
          }
        });
        break;
      // By Usage
      case StatsGroupBy.USAGE:
        aggregation.push({
          $group: {
            _id: { chargeBox: '$chargeBoxID', month: { $month: '$timestamp' }, unit: '' },
            total: { $sum: { $divide: [{ $subtract: ['$stop.timestamp', '$timestamp'] }, 60 * 60 * 1000] } }
          }
        });
        break;
      // By Inactivity
      case StatsGroupBy.INACTIVITY:
        aggregation.push({
          $group: {
            _id: { chargeBox: '$chargeBoxID', month: { $month: '$timestamp' }, unit: '' },
            total: { $sum: { $divide: [{ $add: ['$stop.totalInactivitySecs', '$stop.extraInactivitySecs'] }, 60 * 60] } }
          }
        });
        break;
      // By Transactions
      case StatsGroupBy.TRANSACTIONS:
        aggregation.push({
          $group: {
            _id: { chargeBox: '$chargeBoxID', month: { $month: '$timestamp' }, unit: '' },
            total: { $sum: 1 }
          }
        });
        break;
      // By Pricing
      case StatsGroupBy.PRICING:
        aggregation.push({
          $group: {
            _id: { chargeBox: '$chargeBoxID', month: { $month: '$timestamp' }, unit: '$stop.priceUnit' },
            total: { $sum: '$stop.price' }
          }
        });
        break;
    }
    // Sort
    aggregation.push({
      $sort: { '_id.month': 1, '_id.unit': 1, '_id.chargeBox': 1 }
    });
    // Read DB
    const transactionStatsMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getChargingStationStats', uniqueTimerID, transactionStatsMDB);
    return transactionStatsMDB;
  }

  static async getUserStats(tenantID: string, filters: StatisticFilter, groupBy: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getUserStats');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const match: any = {};
    // Date provided?
    if (filters.startDateTime || filters.endDateTime) {
      match.timestamp = {};
    }
    // Start date
    if (filters.startDateTime) {
      match.timestamp.$gte = Utils.convertToDate(filters.startDateTime);
    }
    // End date
    if (filters.endDateTime) {
      match.timestamp.$lte = Utils.convertToDate(filters.endDateTime);
    }
    // Check stop tr
    if (filters.stop) {
      match.stop = filters.stop;
    }
    // Filter on Site?
    if (!Utils.isEmptyArray(filters.siteIDs)) {
      match.siteID = {
        $in: filters.siteIDs.map((siteID) => Utils.convertToObjectID(siteID))
      };
    }
    // Filter on Site Area?
    if (!Utils.isEmptyArray(filters.siteAreaIDs)) {
      match.siteAreaID = {
        $in: filters.siteAreaIDs.map((siteAreaID) => Utils.convertToObjectID(siteAreaID))
      };
    }
    // Filter on Charge Box?
    if (!Utils.isEmptyArray(filters.chargeBoxIDs)) {
      match.chargeBoxID = {
        $in: filters.chargeBoxIDs.map((chargeBoxID) => chargeBoxID)
      };
    }
    // Filter on User?
    if (!Utils.isEmptyArray(filters.userIDs)) {
      match.userID = {
        $in: filters.userIDs.map((userID) => Utils.convertToObjectID(userID))
      };
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: match
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
    // Resolve Users
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: '_id.userID',
        foreignField: '_id',
        as: 'user'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: { 'path': '$user', 'preserveNullAndEmptyArrays': true }
    });
    // Sort
    aggregation.push({
      $sort: { '_id.month': 1, '_id.unit': 1, '_id.chargeBox': 1 } // Instead of chargeBox userID ?
    });
    // Read DB
    const transactionStatsMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getUserStats', uniqueTimerID, transactionStatsMDB);
    return transactionStatsMDB;
  }
}
