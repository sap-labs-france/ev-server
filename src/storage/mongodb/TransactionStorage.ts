import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from './../../types/GlobalType';
import Logging from '../../utils/Logging';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';
import { DataResult } from '../../types/DataResult';
import User from '../../types/User';
import ConsumptionStorage from './ConsumptionStorage';

export default class TransactionStorage {
  public static async deleteTransaction(tenantID: string, transaction: Transaction): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'deleteTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .findOneAndDelete({ '_id': transaction.id });
    // Delete Meter Values
    await global.database.getCollection<any>(tenantID, 'metervalues')
      .deleteMany({ 'transactionId': transaction.id });
    // Delete Consumptions
    ConsumptionStorage.deleteConsumptions(tenantID, transaction.id);
    // Debug
    Logging.traceEnd('TransactionStorage', 'deleteTransaction', uniqueTimerID, { transaction });
  }

  public static async saveTransaction(tenantID: string, transactionToSave: Partial<Transaction>): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'saveTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // ID not provided?
    if (!transactionToSave.id) {
      transactionToSave.id = await TransactionStorage._findAvailableID(tenantID);
    }
    // Transfer
    const transactionMDB: any = {
      _id: Utils.convertToInt(transactionToSave.id),
      siteID: Utils.convertToObjectID(transactionToSave.siteID),
      siteAreaID: Utils.convertToObjectID(transactionToSave.siteAreaID),
      connectorId: Utils.convertToInt(transactionToSave.connectorId),
      tagID: transactionToSave.tagID,
      userID: Utils.convertToObjectID(transactionToSave.userID),
      chargeBoxID: transactionToSave.chargeBoxID,
      meterStart: Utils.convertToInt(transactionToSave.meterStart),
      timestamp: Utils.convertToDate(transactionToSave.timestamp),
      price: Utils.convertToFloat(transactionToSave.price),
      roundedPrice: Utils.convertToFloat(transactionToSave.roundedPrice),
      priceUnit: transactionToSave.priceUnit,
      pricingSource: transactionToSave.pricingSource,
      stateOfCharge: transactionToSave.stateOfCharge,
      timezone: transactionToSave.timezone,
      signedData: transactionToSave.signedData,
      numberOfMeterValues: Utils.convertToInt(transactionToSave.numberOfMeterValues),
      currentStateOfCharge: Utils.convertToInt(transactionToSave.currentStateOfCharge),
      currentSignedData: transactionToSave.currentSignedData,
      lastMeterValue: transactionToSave.lastMeterValue,
      currentTotalInactivitySecs: Utils.convertToInt(transactionToSave.currentTotalInactivitySecs),
      currentCumulatedPrice: Utils.convertToFloat(transactionToSave.currentCumulatedPrice),
      currentConsumption: Utils.convertToFloat(transactionToSave.currentConsumption),
      currentTotalConsumption: Utils.convertToFloat(transactionToSave.currentTotalConsumption),
    };
    if (transactionToSave.stop) {
      transactionMDB.stop = {
        userID: Utils.convertToObjectID(transactionToSave.stop.userID),
        timestamp: Utils.convertToDate(transactionToSave.stop.timestamp),
        tagID: transactionToSave.stop.tagID,
        meterStop: transactionToSave.stop.meterStop,
        transactionData: transactionToSave.stop.transactionData,
        stateOfCharge: Utils.convertToInt(transactionToSave.stop.stateOfCharge),
        signedData: transactionToSave.stop.signedData,
        totalConsumption: Utils.convertToFloat(transactionToSave.stop.totalConsumption),
        totalInactivitySecs: Utils.convertToInt(transactionToSave.stop.totalInactivitySecs),
        extraInactivitySecs: Utils.convertToInt(transactionToSave.stop.extraInactivitySecs),
        totalDurationSecs: Utils.convertToInt(transactionToSave.stop.totalDurationSecs),
        price: Utils.convertToFloat(transactionToSave.stop.price),
        roundedPrice: Utils.convertToFloat(transactionToSave.stop.roundedPrice),
        priceUnit: transactionToSave.priceUnit,
        pricingSource: transactionToSave.stop.pricingSource
      };
    }
    if (transactionToSave.remotestop) {
      transactionMDB.remotestop = {
        timestamp: Utils.convertToDate(transactionToSave.remotestop.timestamp),
        tagID: transactionToSave.remotestop.tagID,
        userID: Utils.convertToObjectID(transactionToSave.remotestop.userID)
      };
    }
    if (transactionToSave.refundData) {
      transactionMDB.refundData = {
        refundId: transactionToSave.refundData.refundId,
        refundedAt: Utils.convertToDate(transactionToSave.refundData.refundedAt),
        status: transactionToSave.refundData.status,
        type: transactionToSave.refundData.type,
        reportId: transactionToSave.refundData.reportId
      };
    }
    if (transactionToSave.billingData) {
      transactionMDB.billingData = {
        status: transactionToSave.billingData.status,
        errorCode: transactionToSave.billingData.errorCode,
        errorCodeDesc: transactionToSave.billingData.errorCodeDesc,
        invoiceStatus: transactionToSave.billingData.invoiceStatus,
        invoiceItem: transactionToSave.billingData.invoiceItem,
        lastUpdate: Utils.convertToDate(transactionToSave.billingData.lastUpdate),
      };
      if (!transactionMDB.billingData.status) {
        delete transactionMDB.billingData.status;
      }
      if (!transactionMDB.billingData.errorCode) {
        delete transactionMDB.billingData.errorCode;
      }
      if (!transactionMDB.billingData.errorCodeDesc) {
        delete transactionMDB.billingData.errorCodeDesc;
      }
      if (!transactionMDB.billingData.invoiceStatus) {
        delete transactionMDB.billingData.invoiceStatus;
      }
      if (!transactionMDB.billingData.invoiceItem) {
        delete transactionMDB.billingData.invoiceItem;
      }
    }
    // Add Last Changed Created Props
    DatabaseUtils.addLastChangedCreatedProps(transactionMDB, transactionToSave);
    // Modify
    await global.database.getCollection<any>(tenantID, 'transactions').findOneAndReplace(
      { '_id': Utils.convertToInt(transactionToSave.id) },
      transactionMDB,
      { upsert: true });
    // Debug
    Logging.traceEnd('TransactionStorage', 'saveTransaction', uniqueTimerID, { transactionToSave });
    // Return
    return transactionToSave.id;
  }

  public static async assignTransactionsToUser(tenantID: string, user: User) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'assignTransactionsToUser');
    // Assign transactions
    await global.database.getCollection<Transaction>(tenantID, 'transactions').updateMany({
      $and: [
        { 'userID': null },
        { 'tagID': { $in: user.tagIDs } }
      ]
    }, {
      $set: {
        userID: Utils.convertToObjectID(user.id)
      }
    }, {
      upsert: false
    });
    // Debug
    Logging.traceEnd('TransactionStorage', 'assignTransactionsToUser', uniqueTimerID);
  }

  public static async getUnassignedTransactionsCount(tenantID: string, user: User): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'assignTransactionsToUser');
    // Get the number of unassigned transactions
    const unassignedCount = await global.database.getCollection<Transaction>(tenantID, 'transactions').find({
      $and: [
        { 'userID': null },
        { 'tagID': { $in: user.tagIDs } }
      ]
    }).count();
    // Debug
    Logging.traceEnd('TransactionStorage', 'assignTransactionsToUser', uniqueTimerID);
    return unassignedCount;
  }

  public static async getTransactionYears(tenantID: string): Promise<Date[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactionYears');
    // Check
    await Utils.checkTenant(tenantID);
    const firstTransactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .find({})
      .sort({ timestamp: 1 })
      .limit(1)
      .toArray();
    // Found?
    if (!firstTransactionsMDB || firstTransactionsMDB.length === 0) {
      return null;
    }
    const transactionYears = [];
    // Push the rest of the years up to now
    for (let i = new Date(firstTransactionsMDB[0].timestamp).getFullYear(); i <= new Date().getFullYear(); i++) {
      transactionYears.push(i);
    }
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactionYears', uniqueTimerID);
    return transactionYears;
  }

  public static async getTransactions(tenantID: string,
    params: {
      transactionId?: number; search?: string; userIDs?: string[]; siteAdminIDs?: string[]; chargeBoxIDs?:
      string[]; siteAreaIDs?: string[]; siteID?: string[]; connectorId?: number; startDateTime?: Date;
      endDateTime?: Date; stop?: any; minimalPrice?: boolean; withChargeBoxes?: boolean;
      statistics?: 'refund' | 'history'; refundStatus?: string[];
    },
    dbParams: DbParams, projectFields?: string[]):
    Promise<{
      count: number; result: Transaction[]; stats: {
        totalConsumptionWattHours?: number; totalPriceRefund?: number; totalPricePending?: number;
        countRefundTransactions?: number; countPendingTransactions?: number; countRefundedReports?: number; totalDurationSecs?: number;
        totalPrice?: number; currency?: string; totalInactivitySecs?: number; count: number;
      };
    }> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactions');
    // Check
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Build filter
    const ownerMatch = { $or: [] };
    const filterMatch: any = {};
    // User / Site Admin
    if (params.userIDs) {
      ownerMatch.$or.push({
        userID: {
          $in: params.userIDs.map((user) => Utils.convertToObjectID(user))
        }
      });
    }
    if (params.siteAdminIDs) {
      ownerMatch.$or.push({
        siteID: {
          $in: params.siteAdminIDs.map((siteID) => Utils.convertToObjectID(siteID))
        }
      });
    }
    // Filter?
    if (params.transactionId) {
      filterMatch._id = params.transactionId;
    } else if (params.search) {
      // Build filter
      filterMatch.$or = [
        { '_id': parseInt(params.search) },
        { 'tagID': { $regex: params.search, $options: 'i' } },
        { 'chargeBoxID': { $regex: params.search, $options: 'i' } }
      ];
    }
    // Charge Box
    if (params.chargeBoxIDs) {
      filterMatch.chargeBoxID = { $in: params.chargeBoxIDs };
    }
    // Connector
    if (params.connectorId) {
      filterMatch.connectorId = Utils.convertToInt(params.connectorId);
    }
    // Date provided?
    if (params.startDateTime || params.endDateTime) {
      filterMatch.timestamp = {};
    }
    // Start date
    if (params.startDateTime) {
      filterMatch.timestamp.$gte = Utils.convertToDate(params.startDateTime);
    }
    // End date
    if (params.endDateTime) {
      filterMatch.timestamp.$lte = Utils.convertToDate(params.endDateTime);
    }
    // Check stop transaction
    if (params.stop) {
      filterMatch.stop = params.stop;
    }
    if (params.siteAreaIDs) {
      filterMatch.siteAreaID = {
        $in: params.siteAreaIDs.map((area) => Utils.convertToObjectID(area))
      };
    }
    if (params.siteID) {
      filterMatch.siteID = {
        $in: params.siteID.map((site) => Utils.convertToObjectID(site))
      };
    }

    if (params.refundStatus && params.refundStatus.length > 0) {
      const statuses = params.refundStatus.map((status) => status === Constants.REFUND_STATUS_NOT_SUBMITTED ? null : status);
      filterMatch['refundData.status'] = {
        $in: statuses
      };
    }
    if (params.minimalPrice) {
      filterMatch['stop.price'] = { $gt: 0 };
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (ownerMatch.$or && ownerMatch.$or.length > 0) {
      aggregation.push({
        $match: {
          $and: [
            ownerMatch, filterMatch
          ]
        }
      });
    } else {
      aggregation.push({
        $match: filterMatch
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Prepare statistics query
    let statsQuery = null;
    switch (params.statistics) {
      case 'history': // For historical case
        statsQuery = {
          $group: {
            _id: null,
            totalConsumptionWattHours: { $sum: '$stop.totalConsumption' },
            totalDurationSecs: { $sum: '$stop.totalDurationSecs' },
            totalPrice: { $sum: '$stop.price' },
            totalInactivitySecs: { '$sum': { $add: ['$stop.totalInactivitySecs', '$stop.extraInactivitySecs'] } },
            count: { $sum: 1 }
          }
        };
        break;
      case 'refund': // For refund case
        statsQuery = {
          $group: {
            _id: null,
            totalConsumptionWattHours: { $sum: '$stop.totalConsumption' },
            totalPriceRefund: { $sum: { $cond: [{ '$eq': [{ $type: '$refundData' }, 'missing'] }, 0, '$stop.price'] } },
            totalPricePending: { $sum: { $cond: [{ '$eq': [{ $type: '$refundData' }, 'missing'] }, '$stop.price', 0] } },
            countRefundTransactions: { $sum: { $cond: [{ '$eq': [{ $type: '$refundData' }, 'missing'] }, 0, 1] } },
            countPendingTransactions: { $sum: { $cond: [{ '$eq': [{ $type: '$refundData' }, 'missing'] }, 1, 0] } },
            currency: { $addToSet: '$stop.priceUnit' },
            countRefundedReports: { $addToSet: '$refundData.reportId' },
            count: { $sum: 1 }
          }
        };
        break;
      default: // Default case only count
        statsQuery = {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        };
        break;
    }
    // Count Records
    const transactionsCountMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate([...aggregation, statsQuery],
        {
          allowDiskUse: true
        })
      .toArray();
    let transactionCountMDB = (transactionsCountMDB && transactionsCountMDB.length > 0) ? transactionsCountMDB[0] : null;
    // Initialize statistics
    if (!transactionCountMDB) {
      switch (params.statistics) {
        case 'history':
          transactionCountMDB = {
            totalConsumptionWattHours: 0,
            totalDurationSecs: 0,
            totalPrice: 0,
            totalInactivitySecs: 0,
            count: 0
          };
          break;
        case 'refund':
          transactionCountMDB = {
            totalConsumptionWattHours: 0,
            totalPriceRefund: 0,
            totalPricePending: 0,
            countRefundTransactions: 0,
            countPendingTransactions: 0,
            countRefundedReports: 0,
            count: 0
          };
          break;
        default:
          transactionCountMDB = {
            count: 0
          };
          break;
      }
    }
    if (transactionCountMDB && transactionCountMDB.countRefundedReports) {
      // Translate array response to number
      transactionCountMDB.countRefundedReports = transactionCountMDB.countRefundedReports.length;
    }
    if (transactionCountMDB && transactionCountMDB.currency) {
      // Take first entry as reference currency. Expectation is that we have only one currency for all transaction
      transactionCountMDB.currency = transactionCountMDB.currency[0];
    }
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      return {
        count: transactionCountMDB ? transactionCountMDB.count : 0,
        stats: transactionCountMDB ? transactionCountMDB : {},
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();

    // Not yet possible to remove the fields if stop/remoteStop does not exist (MongoDB 4.2)
    // DatabaseUtils.convertObjectIDToString(aggregation, 'stop.userID');
    // DatabaseUtils.convertObjectIDToString(aggregation, 'remotestop.userID');
    // Sort
    if (dbParams.sort) {
      if (!dbParams.sort.timestamp) {
        aggregation.push({
          $sort: { ...dbParams.sort, timestamp: -1 }
        });
      } else {
        aggregation.push({
          $sort: dbParams.sort
        });
      }
    } else {
      aggregation.push({
        $sort: { timestamp: -1 }
      });
    }
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });

    // Charger?
    if (params.withChargeBoxes) {
      // Add Charge Box
      DatabaseUtils.pushChargingStationLookupInAggregation(
        {
          tenantID, aggregation: aggregation, localField: 'chargeBoxID', foreignField: '_id',
          asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
        });
    }
    // Add respective users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID,
      aggregation: aggregation,
      asField: 'user',
      localField: 'userID',
      foreignField: '_id',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID,
      aggregation: aggregation,
      asField: 'stop.user',
      localField: 'stop.userID',
      foreignField: '_id',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });

    // Rename ID
    DatabaseUtils.renameField(aggregation, '_id', 'id');
    // Convert Object ID to string
    DatabaseUtils.convertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteAreaID');

    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const transactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Convert Object IDs to String
    this._convertRemainingTransactionObjectIDs(transactionsMDB);
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactions', uniqueTimerID, { params, dbParams });
    return {
      count: transactionCountMDB ? (transactionCountMDB.count === Constants.DB_RECORD_COUNT_CEIL ? -1 : transactionCountMDB.count) : 0,
      stats: transactionCountMDB ? transactionCountMDB : {},
      result: transactionsMDB
    };
  }

  static async getTransactionsInError(tenantID,
    params: {
      search?: string; userIDs?: string[]; siteAdminIDs?: string[]; chargeBoxIDs?:
      string[]; siteAreaIDs?: string[]; siteID?: string[]; startDateTime?: Date; endDateTime?: Date; withChargeBoxes?: boolean;
      errorType?: ('negative_inactivity' | 'negative_duration' | 'average_consumption_greater_than_connector_capacity' | 'incorrect_starting_date' | 'no_consumption')[];
    },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<Transaction>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactionsInError');
    // Check
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Build filters
    const ownerMatch = { $or: [] };
    const match: any = { stop: { $exists: true } };
    // User / Site Admin
    if (params.userIDs) {
      ownerMatch.$or.push({
        userID: {
          $in: params.userIDs.map((user) => Utils.convertToObjectID(user))
        }
      });
    }
    if (params.siteAdminIDs) {
      ownerMatch.$or.push({
        siteID: {
          $in: params.siteAdminIDs.map((siteID) => Utils.convertToObjectID(siteID))
        }
      });
    }
    // Filter?
    if (params.search) {
      match.$or = [
        { '_id': parseInt(params.search) },
        { 'tagID': { $regex: params.search, $options: 'i' } },
        { 'chargeBoxID': { $regex: params.search, $options: 'i' } }
      ];
    }
    // Charge Box
    if (params.chargeBoxIDs) {
      match.chargeBoxID = { $in: params.chargeBoxIDs };
    }
    // Date provided?
    if (params.startDateTime || params.endDateTime) {
      match.timestamp = {};
    }
    // Start date
    if (params.startDateTime) {
      match.timestamp.$gte = Utils.convertToDate(params.startDateTime);
    }
    // End date
    if (params.endDateTime) {
      match.timestamp.$lte = Utils.convertToDate(params.endDateTime);
    }
    // Site Areas
    if (params.siteAreaIDs) {
      match.siteAreaID = {
        $in: params.siteAreaIDs.map((area) => Utils.convertToObjectID(area))
      };
    }
    // Sites
    if (params.siteID) {
      match.siteID = {
        $in: params.siteID.map((site) => Utils.convertToObjectID(site))
      };
    }
    // Create Aggregation
    let aggregation = [];
    const toSubRequests = [];
    if (ownerMatch.$or && ownerMatch.$or.length > 0) {
      aggregation.push({
        $match: {
          $and: [
            ownerMatch, match
          ]
        }
      });
    } else {
      aggregation.push({
        $match: match
      });
    }
    // Charger?
    if (params.withChargeBoxes) {
      // Add Charge Box
      DatabaseUtils.pushChargingStationLookupInAggregation(
        {
          tenantID, aggregation: toSubRequests, localField: 'chargeBoxID', foreignField: '_id',
          asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
        });
    }
    // Add respective users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID,
      aggregation: toSubRequests,
      asField: 'user',
      localField: 'userID',
      foreignField: '_id',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID,
      aggregation: toSubRequests,
      asField: 'stop.user',
      localField: 'stop.userID',
      foreignField: '_id',
      oneToOneCardinality: true,
      oneToOneCardinalityNotNull: false
    });
    // Build lookups to fetch chargers from transactions
    // used only in the error type : average_consumption_greater_than_connector_capacity
    if(params.errorType && params.errorType.includes('average_consumption_greater_than_connector_capacity')) {
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, 'chargingstations'),
          localField: 'chargeBoxID',
          foreignField: '_id',
          as: 'chargeBox'
        }
      });
    }
    // Build facets for each type of error if any
    if (params.errorType && Array.isArray(params.errorType) && params.errorType.length > 0) {
      const facets: any = { $facet: {} };
      const array = [];
      params.errorType.forEach((type) => {
        array.push(`$${type}`);
        facets.$facet[type] = this._buildTransactionsInErrorFacet(type);
      });
      aggregation.push(facets);
      // Manipulate the results to convert it to an array of document on root level
      aggregation.push({ $project: { 'allItems': { $setUnion: array } } });
      aggregation.push({ $unwind: { 'path': '$allItems' } });
      aggregation.push({ $replaceRoot: { newRoot: '$allItems' } });
      // Add a unique identifier as we may have the same charger several time
      aggregation.push({ $addFields: { 'uniqueId': { $concat: [{ $substr: ['$_id', 0, -1] }, '#', '$errorCode'] } } });
    }
    aggregation = aggregation.concat(toSubRequests);
    // Limit records?
/* START : to improve performance the counting has been disabled temporarily
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const transactionsCountMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    const transactionCountMDB = (transactionsCountMDB && transactionsCountMDB.length > 0) ? transactionsCountMDB[0] : null;
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (transactionCountMDB ? transactionCountMDB.count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
END : */
    // Rename ID
    DatabaseUtils.renameField(aggregation, '_id', 'id');
    // Convert Object ID to string
    DatabaseUtils.convertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteAreaID');
    // Not yet possible to remove the fields if stop/remoteStop does not exist (MongoDB 4.2)
    // DatabaseUtils.convertObjectIDToString(aggregation, 'stop.userID');
    // DatabaseUtils.convertObjectIDToString(aggregation, 'remotestop.userID');
    // Sort
    if (dbParams.sort) {
      if (!dbParams.sort.timestamp) {
        aggregation.push({
          $sort: { ...dbParams.sort, timestamp: -1 }
        });
      } else {
        aggregation.push({
          $sort: dbParams.sort
        });
      }
    } else {
      aggregation.push({
        $sort: { timestamp: -1 }
      });
    }
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
/* START : No limit
    aggregation.push({
      $limit: dbParams.limit
    });
END : */
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const transactionsMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    const transactionCountMDB = transactionsMDB.length;
    // Convert remaining Object IDs to String
    this._convertRemainingTransactionObjectIDs(transactionsMDB);
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactionsInError', uniqueTimerID, {
      params,
      dbParams
    });
    return {
/* START :
//      count: transactionCountMDB ? (transactionCountMDB.count === Constants.DB_RECORD_COUNT_CEIL ? -1 : transactionCountMDB.count) : 0,
END : */
      count: transactionCountMDB,
      result: transactionsMDB
    };
  }

  private static _buildTransactionsInErrorFacet(errorType: string) {
    switch (errorType) {
      case 'no_consumption':
        return [
          { $match: { 'stop.totalConsumption': { $lte: 0 } } },
          { $addFields: { 'errorCode': 'no_consumption' } }
        ];
      case 'negative_inactivity':
        return [
          { $match: { 'stop.totalInactivitySecs': { $lt: 0 } } },
          { $addFields: { 'errorCode': 'negative_inactivity' } }
        ];
      case 'negative_duration':
        return [
          { $match: { 'stop.totalDurationSecs': { $lt: 0 } } },
          { $addFields: { 'errorCode': 'negative_duration' } }
        ];
      case 'incorrect_starting_date':
        return [
          { $match: { 'timestamp': { $lte: Utils.convertToDate('2017-01-01 00:00:00.000Z') } } },
          { $addFields: { 'errorCode': 'incorrect_starting_date' } }
        ];
      case 'average_consumption_greater_than_connector_capacity':
        return [
          { $addFields: { activeDuration: { $subtract: ['$stop.totalDurationSecs', '$stop.totalInactivitySecs'] } } },
          { $match: { 'activeDuration': { $gt: 0 } } },
          { $addFields:{connectors:{$arrayElemAt:['$chargeBox.connectors',0]}}},
          { $addFields:{connectorPower:{$arrayElemAt:['$connectors.power',{$subtract:['$connectorId',1]}]}}},
          { $addFields:{averagePower:{$abs:{$multiply:[{$divide:['$stop.totalConsumption','$activeDuration']},3600]}}}},
          { $addFields:{impossiblePower:{$lte:[{$subtract: ['$connectorPower','$averagePower']},0]}}},
          { $match: { 'impossiblePower': { $eq: true } } },
          { $addFields: { 'errorCode': 'average_consumption_greater_than_connector_capacity' } }
        ];
        case 'missing_price':
          return [
            { $match: { 'stop.price': { $lte: 0 } } },
            { $match: { 'stop.totalConsumption': { $gt: 0 } } },
            { $addFields: { 'errorCode': 'missing_price' } }
          ];
        default:
        return [];
    }
  }

  public static async getTransaction(tenantID: string, id: number): Promise<Transaction> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // Delegate work
    const transactionsMDB = await TransactionStorage.getTransactions(tenantID, { transactionId: id }, Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransaction', uniqueTimerID, { id });
    // Found?
    if (transactionsMDB && transactionsMDB.count > 0) {
      return transactionsMDB.result[0];
    }
    return null;
  }

  public static async getActiveTransaction(tenantID: string, chargeBoxID: string, connectorId: number): Promise<Transaction> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getActiveTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        'chargeBoxID': chargeBoxID,
        'connectorId': Utils.convertToInt(connectorId),
        'stop': { $exists: false }
      }
    });
    // Add User
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID, aggregation, localField: 'userID', foreignField: '_id', asField: 'user',
      oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Rename ID
    DatabaseUtils.renameField(aggregation, '_id', 'id');
    // Convert Object ID to string
    DatabaseUtils.convertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteAreaID');
    // Read DB
    const transactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('TransactionStorage', 'getActiveTransaction', uniqueTimerID, {
      chargeBoxID,
      connectorId
    });
    // Found?
    if (transactionsMDB && transactionsMDB.length > 0) {
      // Convert remaining Object IDs to String
      this._convertRemainingTransactionObjectIDs(transactionsMDB);
      return transactionsMDB[0];
    }
    return null;
  }

  public static async getLastTransaction(tenantID: string, chargeBoxID: string, connectorId: number): Promise<Transaction> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getLastTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        'chargeBoxID': chargeBoxID,
        'connectorId': Utils.convertToInt(connectorId)
      }
    });
    // Rename ID
    DatabaseUtils.renameField(aggregation, '_id', 'id');
    // Convert Object ID to string
    DatabaseUtils.convertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.convertObjectIDToString(aggregation, 'siteAreaID');
    // Sort
    aggregation.push({ $sort: { timestamp: -1 } });
    // The last one
    aggregation.push({ $limit: 1 });
    // Read DB
    const transactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('TransactionStorage', 'getLastTransaction', uniqueTimerID, {
      chargeBoxID,
      connectorId
    });
    // Found?
    if (transactionsMDB && transactionsMDB.length > 0) {
      // Convert remaining Object IDs to String
      this._convertRemainingTransactionObjectIDs(transactionsMDB);
      return transactionsMDB[0];
    }
    return null;
  }

  public static async _findAvailableID(tenantID: string): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', '_findAvailableID');
    // Check
    await Utils.checkTenant(tenantID);
    let existingTransaction: Transaction;
    do {
      // Generate new transaction ID
      const id = Utils.getRandomInt();
      existingTransaction = await TransactionStorage.getTransaction(tenantID, id);
      if (existingTransaction) {
        Logging.logWarning({
          tenantID: tenantID,
          module: 'TransactionStorage',
          method: '_findAvailableID', action: 'nextID',
          message: `Transaction ID '${id}' already exists, generating a new one...`
        });
      } else {
        return id;
      }
    } while (existingTransaction);
    // Debug
    Logging.traceEnd('TransactionStorage', '_findAvailableID', uniqueTimerID);
  }

  private static _convertRemainingTransactionObjectIDs(transactionsMDB: Transaction[]) {
    for (const transactionMDB of transactionsMDB) {
      // Check Stop created by the join
      if (transactionMDB.stop && Utils.isEmptyJSon(transactionMDB.stop)) {
        delete transactionMDB.stop;
      }
      // Check convertion of MongoDB IDs in sub-document
      if (transactionMDB.stop && transactionMDB.stop.userID) {
        transactionMDB.stop.userID = transactionMDB.stop.userID.toString();
      }
      if (transactionMDB.remotestop && transactionMDB.remotestop.userID) {
        transactionMDB.remotestop.userID = transactionMDB.remotestop.userID.toString();
      }
    }
  }
}
