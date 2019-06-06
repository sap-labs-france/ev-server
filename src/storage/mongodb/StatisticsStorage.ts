import Utils from '../../utils/Utils';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import Logging from '../../utils/Logging';
import moment from 'moment';
import TSGlobal from '../../types/GlobalType';
declare var global: TSGlobal;

export default class StatisticsStorage {
  static async getChargingStationStats(tenantID, filter, groupBy) {
    // Debug
    const uniqueTimerID = Logging.traceStart('StatisticsStorage', 'getChargingStationStats');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const match:any = {};
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
    if (filter.siteID) {
      match.siteID = Utils.convertToObjectID(filter.siteID);
    }
    // Filter on Site Area?
    if (filter.siteAreaID) 
    {
      match.siteAreaID = Utils.convertToObjectID(filter.siteAreaID);
    }
    // Filter on Charge Box?
    if (filter.chargeBoxID) {
      match.chargeBoxID = filter.chargeBoxID;
    }
    // Filter on User?
    if (filter.userID) {
      match.userID = Utils.convertToObjectID(filter.userID);
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
      case Constants.STATS_GROUP_BY_CONSUMPTION:
        aggregation.push({
          $group: {
            _id: { chargeBox: "$chargeBoxID", year: { $year: "$timestamp" }, month: { $month: "$timestamp" } },
            total: { $sum: { $divide: ["$stop.totalConsumption", 1000] } }
          }
        });
        break;

      // By usage
      case Constants.STATS_GROUP_BY_USAGE:
        aggregation.push({
          $group: {
            _id: { chargeBox: "$chargeBoxID", year: { $year: "$timestamp" }, month: { $month: "$timestamp" } },
            total: { $sum: { $divide: [{ $subtract: ["$stop.timestamp", "$timestamp"] }, 60 * 60 * 1000] } }
          }
        });
        break;
    }
    // Sort
    aggregation.push({
      $sort: { "_id.month": 1, "_id.chargeBox": 1 }
    });
    // Read DB
    const transactionStatsMDB = await global.database.getCollection(tenantID, 'transactions')
      .aggregate(aggregation)
      .toArray();
    // Set
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
        // Set consumption
        // Add
        transaction[transactionStatMDB._id.chargeBox] = transactionStatMDB.total;
      }
    }
    // Debug
    Logging.traceEnd('StatisticsStorage', 'getChargingStationStats', uniqueTimerID, { filter, groupBy });
    return transactions;
  }

  static async getUserStats(tenantID, filter, groupBy) {
    // Debug
    const uniqueTimerID = Logging.traceStart('StatisticsStorage', 'getUserStats');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Build filter
    const match:any = {};
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
    if (filter.siteID) {
      match.siteID = Utils.convertToObjectID(filter.siteID);
    }    
    // Filter on Site Area?
    if (filter.siteAreaID) 
    {
      match.siteAreaID = Utils.convertToObjectID(filter.siteAreaID);
    }
    // Filter on Charge Box?
    if (filter.chargeBoxID) {
      match.chargeBoxID = filter.chargeBoxID;
    }
    // Filter on User?
    if (filter.userID) {
      match.userID = Utils.convertToObjectID(filter.userID);
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
      case Constants.STATS_GROUP_BY_CONSUMPTION:
        aggregation.push({
          $group: {
            _id: { userID: "$userID", year: { $year: "$timestamp" }, month: { $month: "$timestamp" } },
            total: { $sum: { $divide: ["$stop.totalConsumption", 1000] } }
          }
        });
        break;

      // By usage
      case Constants.STATS_GROUP_BY_USAGE:
        aggregation.push({
          $group: {
            _id: { userID: "$userID", year: { $year: "$timestamp" }, month: { $month: "$timestamp" } },
            total: { $sum: { $divide: [{ $subtract: ["$stop.timestamp", "$timestamp"] }, 60 * 60 * 1000] } }
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
      $unwind: { "path": "$user", "preserveNullAndEmptyArrays": true }
    });
    // Sort
    aggregation.push({
      $sort: { "_id.month": 1, "_id.chargeBox": 1 }
    });
    // Read DB
    const transactionStatsMDB = await global.database.getCollection(tenantID, 'transactions')
      .aggregate(aggregation)
      .toArray();
    // Set
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
        // Set consumption
        transaction[Utils.buildUserFullName(transactionStatMDB.user, false, false, true)] = transactionStatMDB.total;
      }
    }
    // Debug
    Logging.traceEnd('StatisticsStorage', 'getUserStats', uniqueTimerID, { filter, groupBy });
    return transactions;
  }

  static async getCurrentMetrics(tenantID, filteredRequest) {
    // Debug
    const uniqueTimerID = Logging.traceStart('StatisticsStorage', 'getCurrentMetrics');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // filter results of last 6 months
    const transactionDateFilter = moment().utc().startOf('day').subtract(filteredRequest.periodInMonth, 'months').toDate();
    // beginning of the day
    const beginningOfTheDay = moment().utc().startOf('date').toDate();
    // Build filter
    const match = [
      {
        // Get all site area
        "$lookup": {
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
        "$lookup": {
          from: DatabaseUtils.getCollectionName(tenantID, 'chargingstations'),
          let: { siteAreaID: "$siteArea._id" },
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
      /* // Get All transactions 
      {
        "$lookup": {
          from: '5be7fb271014d90008992f06.transactions',
          localField: 'chargingStation._id',
          foreignField: 'chargeBoxID',
          as: 'allTransactions'
        }
      },
      // Filter tables
      {
        "$project": {
          _id: 1,
          companyID: 1,
          name: 1,
          address: 1,
          transactions: 1,
          'chargingStation.maximumPower': 1,
          'chargingStation.cannotChargeInParallel': 1,
          'chargingStation.connectors': 1,
          activeTransactions: {
            $filter: {
              input: '$allTransactions',
              as: 'transaction',
              cond: {
                $and: [
                  { $gte: ["$$transaction.timestamp", beginningOfTheDay] } ,
                  { $ne: [ { $type: '$$transaction.stop' }, "object" ] }
                ]
              }
            }
          },
          finishedTransactions: {
            $filter: {
              input: '$allTransactions',
              as: 'transaction',
              cond: {
                $and: [
                  { $gte: ["$$transaction.timestamp", beginningOfTheDay] } ,
                  { $eq: [ { $type: '$$transaction.stop' }, "object" ] }
                ]
              }
            }
          },
          transactionsTrends: {
            $filter: {
              input: '$allTransactions',
              as: 'transaction',
              cond: {
                $and: [
                  { $gte: ["$$transaction.timestamp", transactionDateFilter] } ,
                  { $eq: [ { $type: '$$transaction.stop' }, "object" ] },
                  { $eq: [ { $dayOfWeek: new Date() },{ $dayOfWeek: "$$transaction.timestamp" }]}
                ]
              }
            }
          }
        }
      },
      // Reduce to necessary fields: site info, transactions and charging station power
      {
        "$project": {
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
            "$sum": "$chargingStation.maximumPower"
          },
          activeCurrentTotalInactivitySecs: {
            "$sum": "$activeTransactions.currentTotalInactivitySecs"
          },
          finishedCurrentTotalInactivitySecs: {
            "$sum": "$activeTransactions.stop.totalInactivitySecs"
          },
          'chargingStation.maximumPower': 1,
          maximumNumberOfChargingPoint: {
            $cond: {
              if: '$chargingStation.cannotChargeInParallel',
              then: 1,
              else: { $size: '$chargingStation.connectors' }
            }
          },
          occupiedChargingPoint: {
            $size: '$activeTransactions'
          },
          'chargingTrendsMinConsumption': {
            $min: "$transactionsTrends.stop.totalConsumption"
          },
          'chargingTrendsMaxConsumption': {
            $max: "$transactionsTrends.stop.totalConsumption"
          },
          'chargingTrendsAvgConsumption': {
            $avg: "$transactionsTrends.stop.totalConsumption"
          },
          'chargingTrendsMinDuration': {
            $min: "$transactionsTrends.stop.totalDurationSecs"
          },
          'chargingTrendsMaxDuration': {
            $max: "$transactionsTrends.stop.totalDurationSecs"
          },
          'chargingTrendsAvgDuration': {
            $avg: "$transactionsTrends.stop.totalDurationSecs"
          },
          'chargingTrendsMinInactivity': {
            $min: "$transactionsTrends.stop.totalInactivitySecs"
          },
          'chargingTrendsMaxInactivity': {
            $max: "$transactionsTrends.stop.totalInactivitySecs"
          },
          'chargingTrendsAvgInactivity': {
            $avg: "$transactionsTrends.stop.totalInactivitySecs"
          },
        }
      }, */
      // Get today active transactions 
      {
        "$lookup": {
          from: DatabaseUtils.getCollectionName(tenantID, 'transactions'),
          let: { chargingStationName: "$chargingStation._id" },
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
        "$lookup": {
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
        "$lookup": {
          from: DatabaseUtils.getCollectionName(tenantID, 'transactions'),
          let: { chargingStationName: "$chargingStation._id" },
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
                    { $eq: [{ $dayOfWeek: new Date() }, { $dayOfWeek: "$timestamp" }] },
                    { $eq: ['$$chargingStationName', '$chargeBoxID'] },
                  ]
                }
              }
            },

            { $replaceRoot: { newRoot: "$stop" } }

          ],
          as: 'transactionsTrends'
        }
      },
      // Reduce to necessary fields: site info, transactions and charging station power
      {
        "$project": {
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
            "$sum": "$chargingStation.maximumPower"
          },
          activeCurrentTotalInactivitySecs: {
            "$sum": "$activeTransactions.currentTotalInactivitySecs"
          },
          finishedCurrentTotalInactivitySecs: {
            "$sum": "$activeTransactions.stop.totalInactivitySecs"
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
            $min: "$transactionsTrends.totalConsumption"
          },
          'chargingTrendsMaxConsumption': {
            $max: "$transactionsTrends.totalConsumption"
          },
          'chargingTrendsAvgConsumption': {
            $avg: "$transactionsTrends.totalConsumption"
          },
          'chargingTrendsMinDuration': {
            $min: "$transactionsTrends.totalDurationSecs"
          },
          'chargingTrendsMaxDuration': {
            $max: "$transactionsTrends.totalDurationSecs"
          },
          'chargingTrendsAvgDuration': {
            $avg: "$transactionsTrends.totalDurationSecs"
          },
          'chargingTrendsMinInactivity': {
            $min: "$transactionsTrends.totalInactivitySecs"
          },
          'chargingTrendsMaxInactivity': {
            $max: "$transactionsTrends.totalInactivitySecs"
          },
          'chargingTrendsAvgInactivity': {
            $avg: "$transactionsTrends.totalInactivitySecs"
          },
        }
      },
      // Aggregate data for site 
      {
        "$group": {
          _id: {
            siteID: "$_id",
            companyID: "$companyID",
            name: "$name",
            address: "$address"
          },
          siteCurrentConsumption: {
            "$sum": "$currentConsumption"
          },
          siteTotalConsumption: {
            "$sum": { $add: ["$activeCurrentTotalConsumption", "$finishedCurrentTotalConsumption"] }
          },
          siteMaximumPower: {
            "$sum": "$chargingStation.maximumPower"
          },
          siteCurrentTotalInactivitySecs: {
            "$sum": { $add: ["$activeCurrentTotalInactivitySecs", "$finishedCurrentTotalInactivitySecs"] }
          },
          siteMaximumNumberOfChargingPoint: {
            "$sum": "$maximumNumberOfChargingPoint"
          },
          siteOccupiedChargingPoint: {
            "$sum": "$occupiedChargingPoint"
          },
          siteChargingTrendsMinConsumption: {
            $min: "$chargingTrendsMinConsumption"
          },
          siteChargingTrendsMaxConsumption: {
            $max: "$chargingTrendsMaxConsumption"
          },
          siteChargingTrendsAvgConsumption: {
            $avg: "$chargingTrendsAvgConsumption"
          },
          siteChargingTrendsMinDuration: {
            $min: "$chargingTrendsMinDuration"
          },
          siteChargingTrendsMaxDuration: {
            $max: "$chargingTrendsMaxDuration"
          },
          siteChargingTrendsAvgDuration: {
            $avg: "$chargingTrendsAvgDuration"
          },
          siteChargingTrendsMinInactivity: {
            $min: "$chargingTrendsMinInactivity"
          },
          siteChargingTrendsMaxInactivity: {
            $max: "$chargingTrendsMaxInactivity"
          },
          siteChargingTrendsAvgInactivity: {
            $avg: "$chargingTrendsAvgInactivity"
          },
        }
      },
      // enrich with company information
      {
        "$lookup": {
          from: DatabaseUtils.getCollectionName(tenantID, 'companies'),
          localField: '_id.companyID',
          foreignField: '_id',
          as: 'company'
        }
      },
      {
        "$unwind": "$company"
      },
      // Add company logo
      {
        "$lookup": {
          from: DatabaseUtils.getCollectionName(tenantID, 'companylogos'),
          localField: '_id.companyID',
          foreignField: '_id',
          as: 'company.logo'
        }
      },
      // enrich with site image
      {
        "$lookup": {
          from: DatabaseUtils.getCollectionName(tenantID, 'siteimages'),
          localField: '_id.siteID',
          foreignField: '_id',
          as: 'site.image'
        }
      },
      {
        "$unwind": "$site.image"
      },
      // sort
      { $sort: { 'company.name': 1, '_id.name': 1 } }

    ];
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push(match);
    // Read DB
    const transactionStatsMDB = await global.database.getCollection(tenantID, 'sites')
      .aggregate(match)
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
            // cumulate company overall results
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
        // push current site
        sites.push(StatisticsStorage.convertDBMetricsToSiteMetrics(transactionStatMDB));
      }
      // push last values
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
    const companyStat:any = {};
    companyStat.company = transactionStatMDB.company;
    // fill in with current consumption and dummy site
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
    const siteStat:any = {};
    siteStat.company = transactionStatMDB.company;
    // fill in with current consumption and dummy site
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


