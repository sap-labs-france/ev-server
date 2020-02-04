import moment from 'moment';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import { StatsGroupBy } from '../../types/Statistic';
import Utils from '../../utils/Utils';

export default class StatisticsStorage {
  static async getChargingStationStats(tenantID, filter, groupBy) {
    // Debug
    const uniqueTimerID = Logging.traceStart('StatisticsStorage', 'getChargingStationStats');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const match: any = {};
    // Date provided?
    if (filter.startDateTime || filter.endDateTime) {
      match.timestamp = {};
    }
    // Start date
    if (filter.startDateTime) {
      match.timestamp.$gte = Utils.convertToDate(filter.startDateTime);
    }
    // End date
    if (filter.endDateTime) {
      match.timestamp.$lte = Utils.convertToDate(filter.endDateTime);
    }
    // Check stop tr
    if (filter.stop) {
      match.stop = filter.stop;
    }
    // Filter on Site?
    if (filter.siteIDs && Array.isArray(filter.siteIDs) && filter.siteIDs.length > 0) {
      match.siteID = {
        $in: filter.siteIDs.map((siteID) => Utils.convertToObjectID(siteID))
      };
    }
    // Filter on Site Area?
    if (filter.siteAreaIDs && Array.isArray(filter.siteAreaIDs) && filter.siteAreaIDs.length > 0) {
      match.siteAreaID = {
        $in: filter.siteAreaIDs.map((siteAreaID) => Utils.convertToObjectID(siteAreaID))
      };
    }
    // Filter on Charge Box?
    if (filter.chargeBoxIDs && Array.isArray(filter.chargeBoxIDs) && filter.chargeBoxIDs.length > 0) {
      match.chargeBoxID = {
        $in: filter.chargeBoxIDs.map((chargeBoxID) => chargeBoxID)
      };
    }
    // Filter on User?
    if (filter.userIDs && Array.isArray(filter.userIDs) && filter.userIDs.length > 0) {
      match.userID = {
        $in: filter.userIDs.map((userID) => Utils.convertToObjectID(userID))
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
            total: { $sum: { $divide: ['$stop.totalConsumption', 1000] } }
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
    Logging.traceEnd('StatisticsStorage', 'getChargingStationStats', uniqueTimerID, { filter, groupBy });
    return transactionStatsMDB;
  }

  static async getUserStats(tenantID, filter, groupBy) {
    // Debug
    const uniqueTimerID = Logging.traceStart('StatisticsStorage', 'getUserStats');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const match: any = {};
    // Date provided?
    if (filter.startDateTime || filter.endDateTime) {
      match.timestamp = {};
    }
    // Start date
    if (filter.startDateTime) {
      match.timestamp.$gte = Utils.convertToDate(filter.startDateTime);
    }
    // End date
    if (filter.endDateTime) {
      match.timestamp.$lte = Utils.convertToDate(filter.endDateTime);
    }
    // Check stop tr
    if (filter.stop) {
      match.stop = filter.stop;
    }
    // Filter on Site?
    if (filter.siteIDs && Array.isArray(filter.siteIDs) && filter.siteIDs.length > 0) {
      match.siteID = {
        $in: filter.siteIDs.map((siteID) => Utils.convertToObjectID(siteID))
      };
    }
    // Filter on Site Area?
    if (filter.siteAreaIDs && Array.isArray(filter.siteAreaIDs) && filter.siteAreaIDs.length > 0) {
      match.siteAreaID = {
        $in: filter.siteAreaIDs.map((siteAreaID) => Utils.convertToObjectID(siteAreaID))
      };
    }
    // Filter on Charge Box?
    if (filter.chargeBoxIDs && Array.isArray(filter.chargeBoxIDs) && filter.chargeBoxIDs.length > 0) {
      match.chargeBoxID = {
        $in: filter.chargeBoxIDs.map((chargeBoxID) => chargeBoxID)
      };
    }
    // Filter on User?
    if (filter.userIDs && Array.isArray(filter.userIDs) && filter.userIDs.length > 0) {
      match.userID = {
        $in: filter.userIDs.map((userID) => Utils.convertToObjectID(userID))
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
            total: { $sum: { $divide: ['$stop.totalConsumption', 1000] } }
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
    Logging.traceEnd('StatisticsStorage', 'getUserStats', uniqueTimerID, { filter, groupBy });
    return transactionStatsMDB;
  }

  static async getCurrentMetrics(tenantID, filteredRequest) {
    // Debug
    const uniqueTimerID = Logging.traceStart('StatisticsStorage', 'getCurrentMetrics');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Filter results of last 6 months
    const transactionDateFilter = moment().utc().startOf('day').subtract(filteredRequest.periodInMonth, 'months').toDate();
    // Beginning of the day
    const beginningOfTheDay = moment().utc().startOf('date').toDate();
    // Build filter
    const match = [
      {
        // Get all site area
        '$lookup': {
          from: DatabaseUtils.getCollectionName(tenantID, 'siteareas'),
          localField: '_id',
          foreignField: 'siteID',
          as: 'siteArea'
        }
      },
      {
        $unwind: '$siteArea'
      },
      // Get all charging stations
      {
        '$lookup': {
          from: DatabaseUtils.getCollectionName(tenantID, 'chargingstations'),
          let: { siteAreaID: '$siteArea._id' },
          pipeline: [ // Exclude deleted chargers
            {
              $match: {
                $or: [
                  { deleted: false },
                  { deleted: { $exists: false } }]
              }
            },
            {
              $match: {
                $expr:
                  { $eq: ['$$siteAreaID', '$siteAreaID'] }

              }
            },
          ],
          as: 'chargingStation'
        }
      },
      {
        $unwind: '$chargingStation'
      },
      // Get today active transactions
      {
        '$lookup': {
          from: DatabaseUtils.getCollectionName(tenantID, 'transactions'),
          let: { chargingStationName: '$chargingStation._id' },
          pipeline: [
            {
              $match: {
                $and: [
                  { timestamp: { $gte: beginningOfTheDay } },
                  { stop: { $exists: false } }]
              }
            },
            {
              $match: {
                $expr:
                  { $eq: ['$$chargingStationName', '$chargeBoxID'] }

              }
            },
          ],
          as: 'activeTransactions'
        }
      },
      // Get today finished transactions
      {
        '$lookup': {
          from: DatabaseUtils.getCollectionName(tenantID, 'transactions'),
          let: { chargingStationName: '$chargingStation._id' },
          pipeline: [
            {
              $match: {
                $and: [
                  { timestamp: { $gte: beginningOfTheDay } },
                  { stop: { $exists: true } }]
              }
            },
            {
              $match: {
                $expr:
                  { $eq: ['$$chargingStationName', '$chargeBoxID'] }

              }
            },
          ],
          as: 'finishedTransactions'
        }
      },
      // Get transactions of the same week day
      {
        '$lookup': {
          from: DatabaseUtils.getCollectionName(tenantID, 'transactions'),
          let: { chargingStationName: '$chargingStation._id' },
          pipeline: [
            {
              $match: {
                $and:
                  [
                    { stop: { $exists: true } },
                    { timestamp: { $gte: transactionDateFilter } }
                  ]
              }
            },
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: [{ $dayOfWeek: new Date() }, { $dayOfWeek: '$timestamp' }] },
                    { $eq: ['$$chargingStationName', '$chargeBoxID'] },
                  ]
                }
              }
            },

            { $replaceRoot: { newRoot: '$stop' } }

          ],
          as: 'transactionsTrends'
        }
      },
      // Reduce to necessary fields: site info, transactions and charging station power
      {
        '$project': {
          _id: 1,
          companyID: 1,
          name: 1,
          address: 1,
          transactions: 1,
          currentConsumption: {
            $sum: '$activeTransactions.currentConsumption'
          },
          activeCurrentTotalConsumption: {
            $sum: '$activeTransactions.currentTotalConsumption'
          },
          finishedCurrentTotalConsumption: {
            $sum: '$finishedTransactions.stop.totalConsumption'
          },
          maximumPower: {
            '$sum': '$chargingStation.maximumPower'
          },
          activeCurrentTotalInactivitySecs: {
            '$sum': '$activeTransactions.currentTotalInactivitySecs'
          },
          finishedCurrentTotalInactivitySecs: {
            '$sum': '$activeTransactions.stop.totalInactivitySecs'
          },
          'chargingStation.maximumPower': 1,
          maximumNumberOfChargingPoint: {
            // $cond: {
            //   if: '$chargingStation.cannotChargeInParallel',
            //   then: 1,
            //   else: {
            $size: '$chargingStation.connectors'
            //   }
            // }

          },
          occupiedChargingPoint: {
            $size: '$activeTransactions'
          },
          'chargingTrendsMinConsumption': {
            $min: '$transactionsTrends.totalConsumption'
          },
          'chargingTrendsMaxConsumption': {
            $max: '$transactionsTrends.totalConsumption'
          },
          'chargingTrendsAvgConsumption': {
            $avg: '$transactionsTrends.totalConsumption'
          },
          'chargingTrendsMinDuration': {
            $min: '$transactionsTrends.totalDurationSecs'
          },
          'chargingTrendsMaxDuration': {
            $max: '$transactionsTrends.totalDurationSecs'
          },
          'chargingTrendsAvgDuration': {
            $avg: '$transactionsTrends.totalDurationSecs'
          },
          'chargingTrendsMinInactivity': {
            $min: '$transactionsTrends.totalInactivitySecs'
          },
          'chargingTrendsMaxInactivity': {
            $max: '$transactionsTrends.totalInactivitySecs'
          },
          'chargingTrendsAvgInactivity': {
            $avg: '$transactionsTrends.totalInactivitySecs'
          },
        }
      },
      // Aggregate data for site
      {
        '$group': {
          _id: {
            siteID: '$_id',
            companyID: '$companyID',
            name: '$name',
            address: '$address'
          },
          siteCurrentConsumption: {
            '$sum': '$currentConsumption'
          },
          siteTotalConsumption: {
            '$sum': { $add: ['$activeCurrentTotalConsumption', '$finishedCurrentTotalConsumption'] }
          },
          siteMaximumPower: {
            '$sum': '$chargingStation.maximumPower'
          },
          siteCurrentTotalInactivitySecs: {
            '$sum': { $add: ['$activeCurrentTotalInactivitySecs', '$finishedCurrentTotalInactivitySecs'] }
          },
          siteMaximumNumberOfChargingPoint: {
            '$sum': '$maximumNumberOfChargingPoint'
          },
          siteOccupiedChargingPoint: {
            '$sum': '$occupiedChargingPoint'
          },
          siteChargingTrendsMinConsumption: {
            $min: '$chargingTrendsMinConsumption'
          },
          siteChargingTrendsMaxConsumption: {
            $max: '$chargingTrendsMaxConsumption'
          },
          siteChargingTrendsAvgConsumption: {
            $avg: '$chargingTrendsAvgConsumption'
          },
          siteChargingTrendsMinDuration: {
            $min: '$chargingTrendsMinDuration'
          },
          siteChargingTrendsMaxDuration: {
            $max: '$chargingTrendsMaxDuration'
          },
          siteChargingTrendsAvgDuration: {
            $avg: '$chargingTrendsAvgDuration'
          },
          siteChargingTrendsMinInactivity: {
            $min: '$chargingTrendsMinInactivity'
          },
          siteChargingTrendsMaxInactivity: {
            $max: '$chargingTrendsMaxInactivity'
          },
          siteChargingTrendsAvgInactivity: {
            $avg: '$chargingTrendsAvgInactivity'
          },
        }
      },
      // Enrich with company information
      {
        '$lookup': {
          from: DatabaseUtils.getCollectionName(tenantID, 'companies'),
          localField: '_id.companyID',
          foreignField: '_id',
          as: 'company'
        }
      },
      {
        '$unwind': '$company'
      },
      // Add company logo
      {
        '$lookup': {
          from: DatabaseUtils.getCollectionName(tenantID, 'companylogos'),
          localField: '_id.companyID',
          foreignField: '_id',
          as: 'company.logo'
        }
      },
      // Enrich with site image
      {
        '$lookup': {
          from: DatabaseUtils.getCollectionName(tenantID, 'siteimages'),
          localField: '_id.siteID',
          foreignField: '_id',
          as: 'site.image'
        }
      },
      {
        '$unwind': '$site.image'
      },
      // Sort
      { $sort: { 'company.name': 1, '_id.name': 1 } }

    ];
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push(match);
    // Read DB
    const transactionStatsMDB = await global.database.getCollection<any>(tenantID, 'sites')
      .aggregate(match, { allowDiskUse: true })
      .toArray();
    // Set
    let currentMetrics = [];
    // Create
    if (transactionStatsMDB && transactionStatsMDB.length > 0) {
      // Create
      let companyStat = null;
      let sites = [];
      for (const transactionStatMDB of transactionStatsMDB) {
        // Check if we change to another company
        if (companyStat && companyStat.companyID !== transactionStatMDB.company._id.toString()) {
          companyStat.trends.totalConsumption.avg = companyStat.trends.totalConsumption.avg / sites.length;
          companyStat.trends.duration.avg = companyStat.trends.duration.avg / sites.length;
          companyStat.trends.inactivity.avg = companyStat.trends.inactivity.avg / sites.length;
          currentMetrics.push(companyStat);
          currentMetrics = [...currentMetrics, ...sites];
          sites = [];
          companyStat = StatisticsStorage.convertDBMetricsToCompanyMetrics(transactionStatMDB);
        } else {
          // Initialize company as if it is a site with a fixed name ALL
          if (!companyStat) {
            companyStat = StatisticsStorage.convertDBMetricsToCompanyMetrics(transactionStatMDB);
          } else {
            // Cumulate company overall results
            companyStat.currentConsumption += transactionStatMDB.siteCurrentConsumption;
            companyStat.totalConsumption += transactionStatMDB.siteTotalConsumption;
            companyStat.currentTotalInactivitySecs += transactionStatMDB.siteCurrentTotalInactivitySecs;
            companyStat.maximumPower += transactionStatMDB.siteMaximumPower;
            companyStat.maximumNumberOfChargingPoint += transactionStatMDB.siteMaximumNumberOfChargingPoint;
            companyStat.occupiedChargingPoint += transactionStatMDB.siteOccupiedChargingPoint;
            companyStat.trends.totalConsumption.min = (transactionStatMDB.siteChargingTrendsMinConsumption < companyStat.trends.totalConsumption.min ? transactionStatMDB.siteChargingTrendsMinConsumption : companyStat.trends.totalConsumption.min);
            companyStat.trends.totalConsumption.max = (transactionStatMDB.siteChargingTrendsMaxConsumption > companyStat.trends.totalConsumption.max ? transactionStatMDB.siteChargingTrendsMaxConsumption : companyStat.trends.totalConsumption.max);
            companyStat.trends.totalConsumption.avg += transactionStatMDB.siteChargingTrendsAvgConsumption;
            companyStat.trends.duration.min = (transactionStatMDB.siteChargingTrendsMinDuration < companyStat.trends.duration.min ? transactionStatMDB.siteChargingTrendsMinDuration : companyStat.trends.duration.min);
            companyStat.trends.duration.max = (transactionStatMDB.siteChargingTrendsMaxDuration > companyStat.trends.duration.max ? transactionStatMDB.siteChargingTrendsMaxDuration : companyStat.trends.duration.max);
            companyStat.trends.duration.avg += transactionStatMDB.siteChargingTrendsAvgDuration;
            companyStat.trends.inactivity.min = (transactionStatMDB.siteChargingTrendsMinInactivity < companyStat.trends.inactivity.min ? transactionStatMDB.siteChargingTrendsMinInactivity : companyStat.trends.inactivity.min);
            companyStat.trends.inactivity.max = (transactionStatMDB.siteChargingTrendsMaxInactivity > companyStat.trends.inactivity.max ? transactionStatMDB.siteChargingTrendsMaxInactivity : companyStat.trends.inactivity.max);
            companyStat.trends.inactivity.avg += transactionStatMDB.siteChargingTrendsAvgInactivity;
            companyStat.address.push(transactionStatMDB._id.address);
          }
        }
        // Push current site
        sites.push(StatisticsStorage.convertDBMetricsToSiteMetrics(transactionStatMDB));
      }
      // Push last values
      companyStat.trends.totalConsumption.avg = companyStat.trends.totalConsumption.avg / sites.length;
      companyStat.trends.duration.avg = companyStat.trends.duration.avg / sites.length;
      companyStat.trends.inactivity.avg = companyStat.trends.inactivity.avg / sites.length;
      currentMetrics.push(companyStat);
      currentMetrics = [...currentMetrics, ...sites];
    }

    // Debug
    Logging.traceEnd('StatisticsStorage', 'getcurrentMetrics', uniqueTimerID, { filteredRequest });
    return currentMetrics;
  }

  static convertDBMetricsToCompanyMetrics(transactionStatMDB) {
    const companyStat: any = {};
    companyStat.company = transactionStatMDB.company;
    // Fill in with current consumption and dummy site
    companyStat.currentConsumption = transactionStatMDB.siteCurrentConsumption;
    companyStat.totalConsumption = transactionStatMDB.siteTotalConsumption;
    companyStat.currentTotalInactivitySecs = transactionStatMDB.siteCurrentTotalInactivitySecs;
    companyStat.maximumPower = transactionStatMDB.siteMaximumPower;
    companyStat.maximumNumberOfChargingPoint = transactionStatMDB.siteMaximumNumberOfChargingPoint;
    companyStat.occupiedChargingPoint = transactionStatMDB.siteOccupiedChargingPoint;
    companyStat.name = 'ALL';
    companyStat.id = 'ALL';
    companyStat.companyID = transactionStatMDB.company._id.toString();
    companyStat.address = [transactionStatMDB._id.address];
    if (Array.isArray(transactionStatMDB.company.logo) && transactionStatMDB.company.logo.length > 0) {
      companyStat.image = transactionStatMDB.company.logo[0].logo;
    }
    companyStat.trends = { totalConsumption: {}, duration: {}, inactivity: {} };
    companyStat.trends.totalConsumption.min = transactionStatMDB.siteChargingTrendsMinConsumption;
    companyStat.trends.totalConsumption.max = transactionStatMDB.siteChargingTrendsMaxConsumption;
    companyStat.trends.totalConsumption.avg = transactionStatMDB.siteChargingTrendsAvgConsumption;
    companyStat.trends.duration.min = transactionStatMDB.siteChargingTrendsMinDuration;
    companyStat.trends.duration.max = transactionStatMDB.siteChargingTrendsMaxDuration;
    companyStat.trends.duration.avg = transactionStatMDB.siteChargingTrendsAvgDuration;
    companyStat.trends.inactivity.min = transactionStatMDB.siteChargingTrendsMinInactivity;
    companyStat.trends.inactivity.max = transactionStatMDB.siteChargingTrendsMaxInactivity;
    companyStat.trends.inactivity.avg = transactionStatMDB.siteChargingTrendsAvgInactivity;
    return companyStat;
  }

  static convertDBMetricsToSiteMetrics(transactionStatMDB) {
    const siteStat: any = {};
    siteStat.company = transactionStatMDB.company;
    // Fill in with current consumption and dummy site
    siteStat.currentConsumption = transactionStatMDB.siteCurrentConsumption;
    siteStat.totalConsumption = transactionStatMDB.siteTotalConsumption;
    siteStat.currentTotalInactivitySecs = transactionStatMDB.siteCurrentTotalInactivitySecs;
    siteStat.maximumPower = transactionStatMDB.siteMaximumPower;
    siteStat.maximumNumberOfChargingPoint = transactionStatMDB.siteMaximumNumberOfChargingPoint;
    siteStat.occupiedChargingPoint = transactionStatMDB.siteOccupiedChargingPoint;
    siteStat.name = transactionStatMDB._id.name;
    siteStat.id = transactionStatMDB._id.siteID.toString();
    siteStat.companyID = transactionStatMDB.company._id.toString();
    siteStat.address = [transactionStatMDB._id.address];
    if (transactionStatMDB.site && transactionStatMDB.site.image) {
      siteStat.image = transactionStatMDB.site.image.image;
    }
    siteStat.trends = { totalConsumption: {}, duration: {}, inactivity: {} };
    siteStat.trends.totalConsumption.min = transactionStatMDB.siteChargingTrendsMinConsumption;
    siteStat.trends.totalConsumption.max = transactionStatMDB.siteChargingTrendsMaxConsumption;
    siteStat.trends.totalConsumption.avg = transactionStatMDB.siteChargingTrendsAvgConsumption;
    siteStat.trends.duration.min = transactionStatMDB.siteChargingTrendsMinDuration;
    siteStat.trends.duration.max = transactionStatMDB.siteChargingTrendsMaxDuration;
    siteStat.trends.duration.avg = transactionStatMDB.siteChargingTrendsAvgDuration;
    siteStat.trends.inactivity.min = transactionStatMDB.siteChargingTrendsMinInactivity;
    siteStat.trends.inactivity.max = transactionStatMDB.siteChargingTrendsMaxInactivity;
    siteStat.trends.inactivity.avg = transactionStatMDB.siteChargingTrendsAvgInactivity;
    return siteStat;
  }

}
