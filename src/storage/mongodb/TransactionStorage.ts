import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from './../../types/GlobalType';
import Logging from '../../utils/Logging';
import PricingStorage from './PricingStorage';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';
import DbLookup from '../../types/database/DBLookup';

export default class TransactionStorage {
  public static async deleteTransaction(tenantID: string, transaction: Transaction): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'deleteTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection<any>(tenantID, 'transactions')
      .findOneAndDelete({ '_id': transaction.id });
    // Delete Meter Values
    await global.database.getCollection<any>(tenantID, 'metervalues')
      .deleteMany({ 'transactionId': transaction.id });
    // Delete Consumptions
    await global.database.getCollection<any>(tenantID, 'consumptions')
      .deleteMany({ 'transactionId': transaction.id });
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
      // No: Check for a new ID
      transactionToSave.id = await TransactionStorage._findAvailableID(tenantID);
    }
    // Transfer
    let transactionMDB: any = {
      _id: transactionToSave.id,
      siteID: transactionToSave.siteID,
      siteAreaID: transactionToSave.siteAreaID,
      connectorId: transactionToSave.connectorId,
      tagID: transactionToSave.tagID,
      userID: transactionToSave.userID,
      chargeBoxID: transactionToSave.chargeBoxID,
      meterStart: transactionToSave.meterStart,
      timestamp: transactionToSave.timestamp,
      price: transactionToSave.price,
      roundedPrice: transactionToSave.roundedPrice,
      priceUnit: transactionToSave.priceUnit,
      pricingSource: transactionToSave.pricingSource,
      stateOfCharge: transactionToSave.stateOfCharge,
      timezone: transactionToSave.timezone,
      signedData: transactionToSave.signedData,

      numberOfMeterValues: transactionToSave.numberOfMeterValues,
      currentStateOfCharge: transactionToSave.currentStateOfCharge,
      currentSignedData: transactionToSave.currentSignedData,
      lastMeterValue: transactionToSave.lastMeterValue,
      currentTotalInactivitySecs: transactionToSave.currentTotalInactivitySecs,
      currentCumulatedPrice: transactionToSave.currentCumulatedPrice,
      currentConsumption: transactionToSave.currentConsumption,
      currentTotalConsumption: transactionToSave.currentTotalConsumption,
    };
    if (transactionToSave.stop) {
      transactionMDB.stop = {
        userID: Utils.convertToObjectID(transactionToSave.stop.userID),
        timestamp: transactionToSave.stop.timestamp,
        tagID: transactionToSave.stop.tagID,
        meterStop: transactionToSave.stop.meterStop,
        transactionData: transactionToSave.stop.transactionData,
        stateOfCharge: transactionToSave.stop.stateOfCharge,
        signedData: transactionToSave.stop.signedData,
        totalConsumption: transactionToSave.stop.totalConsumption,
        totalInactivitySecs: transactionToSave.stop.totalInactivitySecs,
        extraInactivitySecs: transactionToSave.stop.extraInactivitySecs,
        totalDurationSecs: transactionToSave.stop.totalDurationSecs,
        price: transactionToSave.stop.price,
        roundedPrice: transactionToSave.stop.roundedPrice,
        priceUnit: transactionToSave.priceUnit,
        pricingSource: transactionToSave.stop.pricingSource
      }
    }
    if(transactionToSave.remotestop) {
      transactionMDB.remotestop = {
        timestamp: transactionToSave.remotestop.timestamp,
        tagID: transactionToSave.remotestop.tagID
      }
    }
    if(transactionToSave.refundData) {
      transactionMDB.refundData = {
        refundId: transactionToSave.refundData.refundId,
        refundedAt: transactionToSave.refundData.refundedAt,
        status: transactionToSave.refundData.status,
        type: transactionToSave.refundData.type,
        reportId: transactionToSave.refundData.reportId
      };
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

  public static async getTransactionYears(tenantID: string) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactionYears');
    // Check
    await Utils.checkTenant(tenantID);
    const firstTransactionsMDB = await global.database.getCollection<any>(tenantID, 'transactions')
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
      // Add
      transactionYears.push(i);
    }
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactionYears', uniqueTimerID);
    return transactionYears;
  }

  public static async getTransactions(tenantID: string,
    params:{ transactionId?: number; search?: string; userIDs?: string[]; chargeBoxIDs?: string; siteAreaIDs?: string[]; siteID?: string;
      connectorId?: number; startTime?: Date; endTime?: Date; stop?: any; refundType?: 'refunded'|'notRefunded'; minimalPrice?: boolean;
      withChargeBoxes?: boolean; statistics?: 'refund'|'history', refundStatus?: string;
      errorType?: ('negative_inactivity'|'average_consumption_greater_than_connector_capacity'|'no_consumption')[] },//TODO change the any
    dbParams: DbParams, projectFields?: string[]):
  Promise<{count: number, stats: {
    totalConsumptionWattHours?: number,
    totalPriceRefund?: number,
    totalPricePending?: number,
    countRefundTransactions?: number,
    countPendingTransactions?: number,
    countRefundedReports?: number,
    totalDurationSecs?: number,
    totalPrice?: number,
    currency?: string,
    totalInactivitySecs?: number,
    count: number
  }, result: Transaction[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactions');
    // Check
    await Utils.checkTenant(tenantID);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Build filter
    const match: any = {};
    // Filter?
    if (params.transactionId) {
      match._id = params.transactionId;
    } else if (params.search) {
      // Build filter
      match.$or = [
        { '_id': parseInt(params.search) },
        { 'tagID': { $regex: params.search, $options: 'i' } },
        { 'chargeBoxID': { $regex: params.search, $options: 'i' } }
      ];
    }
    // User
    if (params.userIDs) {
      match.userID = {
        $in: params.userIDs.map((user) => Utils.convertToObjectID(user))
      };
    }
    // Charge Box
    if (params.chargeBoxIDs) {
      match.chargeBoxID = { $in : params.chargeBoxIDs };
    }
    // Connector
    if (params.connectorId) {
      match.connectorId = Utils.convertToInt(params.connectorId);
    }
    // Date provided?
    if (params.startTime || params.endTime) {
      match.timestamp = {};
      // Start date
      if (params.startTime) {
        match.timestamp.$gte = Utils.convertToDate(params.startTime);
      }
      // End date
      if (params.endTime) {
        match.timestamp.$lte = Utils.convertToDate(params.endTime);
      }
    }
    // Check stop transaction
    if (params.stop) {
      match.stop = params.stop;
    }
    if (params.siteAreaIDs) {
      match.siteAreaID = {
        $in: params.siteAreaIDs.map((area) => Utils.convertToObjectID(area))
      };
    }
    if (params.siteID) {
      match.siteID = Utils.convertToObjectID(params.siteID);
    }
    if (params.refundType) {
      switch (params.refundType) {
        case Constants.REFUND_TYPE_REFUNDED:
          match.refundData = { $exists: true };
          if (params.refundStatus) {
            match['refundData.status'] = params.refundStatus;
          }
          break;
        case Constants.REFUND_TYPE_NOT_REFUNDED:
          match.refundData = { $exists: false };
          break;
      }
    }
    if (params.minimalPrice) {
      match['stop.price'] = { $gt: 0 };
    }
    // Create Aggregation
    let aggregation = [];
    const toSubRequests = [];
    // Filters
    if (match) {
      aggregation.push({
        $match: match
      });
    }
    // Charger?
    if (params.withChargeBoxes) {
      // Add Charge Box
      DatabaseUtils.pushChargingStationLookupInAggregation(
        { tenantID, aggregation: toSubRequests, localField: 'chargeBoxID', foreignField: '_id',
          asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false });
    }
    // Add respective users
    DatabaseUtils.pushUserLookupInAggregation({ tenantID, aggregation: toSubRequests, asField: 'user',
      localField: 'userID', foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false });
    DatabaseUtils.pushUserLookupInAggregation({ tenantID, aggregation: toSubRequests, asField: 'stop.user',
      localField: 'stop.userID', foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false });

    const facets = TransactionStorage._filterTransactionsInErrorFacets(tenantID, params.errorType);
    if (facets) {
      const facetNames = [];
      for (const facet in facets.$facet) {
        facets.$facet[facet] = [...facets.$facet[facet], ...toSubRequests];
        facetNames.push(`$${facet}`);
      }
      aggregation.push(facets);
      // Manipulate the results to convert it to an array of document on root level
      aggregation.push({ $project: { 'allItems': { $concatArrays: facetNames } } });
      aggregation.push({ $unwind: { 'path': '$allItems' } });
      aggregation.push({ $replaceRoot: { newRoot: '$allItems' } });
      // Add a unique identifier as we may have the same charger several time
      aggregation.push({ $addFields: { 'uniqueId': { $concat: [{ $substr: ['$_id', 0, -1] }, '#', '$errorCode'] } } });
    } else {
      aggregation = aggregation.concat(toSubRequests);
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
            totalPriceRefund: { $sum: { $cond: [ { '$eq': [ { $type : '$refundData' }, 'missing' ] }, 0, '$stop.price' ] } },
            totalPricePending: { $sum: { $cond: [ { '$eq': [ { $type : '$refundData' }, 'missing' ] }, '$stop.price', 0 ] } },
            countRefundTransactions: { $sum: { $cond: [ { '$eq': [ { $type : '$refundData' }, 'missing' ] }, 0, 1 ] } },
            countPendingTransactions: { $sum: { $cond: [ { '$eq': [ { $type : '$refundData' }, 'missing' ] }, 1, 0 ] } },
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
      // Sort
    } else {
      // Default
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
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Rename ID
    DatabaseUtils.renameField(aggregation, '_id', 'id');
    // Read DB
    const transactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactions', uniqueTimerID, { params, dbParams });
    return {
      count: transactionCountMDB ? (transactionCountMDB.count === Constants.DB_RECORD_COUNT_CEIL ? -1 : transactionCountMDB.count) : 0,
      stats: transactionCountMDB ? transactionCountMDB : {},
      result: transactionsMDB
    };
  }

  private static _filterTransactionsInErrorFacets(tenantID: string,
    errorType?: ('negative_inactivity'|'average_consumption_greater_than_connector_capacity'|'no_consumption')[]) {
    const facets = {
      '$facet':
      {
        'no_consumption':
          [
            {
              $match: {
                $and: [
                  { 'stop': { $exists: true } },
                  { 'stop.totalConsumption': { $lte: 0 } }
                ]
              }
            },
            { $addFields: { 'errorCode': 'no_consumption' } }
          ],
        'average_consumption_greater_than_connector_capacity': [],
        'negative_inactivity':
          [
            {
              $match: {
                $and: [
                  { 'stop': { $exists: true } },
                  { 'stop.totalInactivitySecs': { $lt: 0 } }
                ]
              }
            },
            { $addFields: { 'errorCode': 'negative_inactivity' } }
          ],
        'incorrect_starting_date':
          [
            { $match: { 'timestamp': { $lte : Utils.convertToDate('2017-01-01 00:00:00.000Z') } } },
            { $addFields: { 'errorCode': 'incorrect_starting_date' } }
          ]
      }
    };
    facets.$facet.average_consumption_greater_than_connector_capacity.push(
      { $match: { 'stop': { $exists: true } } },
      { $addFields: { activeDuration: { $subtract: ['$stop.totalDurationSecs', '$stop.totalInactivitySecs'] } } },
      { $match: { 'activeDuration': { $gt: 0 } } }
    );
    DatabaseUtils.pushChargingStationLookupInAggregation({ tenantID, aggregation: facets.$facet.average_consumption_greater_than_connector_capacity,
     localField: 'chargeBoxID', foreignField: '_id', asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false})
    facets.$facet.average_consumption_greater_than_connector_capacity.push(
      { $addFields: { connector: { $arrayElemAt: ['$chargeBox.connectors', { $subtract: ['$connectorId', 1] }] } } },
      { $addFields: { averagePower: { $multiply: [{ $divide: ['$stop.totalConsumption', '$activeDuration'] }, 3600] } } },
      { $addFields: { impossiblePower: { $lte: [{ $subtract: ['$connector.power', '$averagePower'] }, 0] } } },
      { $match: { 'impossiblePower': { $eq: true } } },
      { $addFields: { 'errorCode': 'average_consumption_greater_than_connector_capacity' } }
    );
    let filteredFacets: any = null;
    if (errorType) {
      filteredFacets = { $facet: {} };
      if(errorType.includes('no_consumption')) {
        filteredFacets.$facet.no_consumption = facets.$facet.no_consumption;
      }
      if(errorType.includes('negative_inactivity')) {
        filteredFacets.$facet.negative_activity = facets.$facet.negative_inactivity;
      }
      if(errorType.includes('average_consumption_greater_than_connector_capacity')) {
        filteredFacets.$facet.average_consumption_greater_than_connector_capacity = facets.$facet.average_consumption_greater_than_connector_capacity;
      }
    }
    return filteredFacets;
  }

  public static async getTransaction(tenantID: string, id: number): Promise<Transaction> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransaction');
    // Check
    await Utils.checkTenant(tenantID);

    //Delegate work
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
    DatabaseUtils.pushUserLookupInAggregation({ tenantID, aggregation, localField: 'userID', foreignField: '_id', asField: 'user',
      oneToOneCardinality: true, oneToOneCardinalityNotNull: false });
    // Rename ID
    DatabaseUtils.renameField(aggregation, '_id', 'id');
    // Read DB
    const transactionsMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('TransactionStorage', 'getActiveTransaction', uniqueTimerID, { chargeBoxID, connectorId });
    // Found?
    if (transactionsMDB && transactionsMDB.length > 0) {
      return new transactionsMDB[0];
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
    aggregation.push({ $sort: { timestamp: -1 } });
    // The last one
    aggregation.push({ $limit: 1 }); // TODO Use getTransactions so that I dont need to query charging stations etc here as well oof
    // Read DB
    const transactionsMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('TransactionStorage', 'getLastTransaction', uniqueTimerID, { chargeBoxID, connectorId });
    // Found?
    if (transactionsMDB && transactionsMDB.length > 0) {
      return transactionsMDB[0];
    }
    return null;
  }

  public static async _findAvailableID(tenantID: string): Promise<number> { //TODO ...Why not just increment it??
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
}
