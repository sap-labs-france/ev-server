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
  public static async deleteTransaction(tenantID: string, transaction: Transaction) {
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
    const transactionMDB: any = {
      _id: transactionToSave.id,
      siteID: Utils.convertToObjectID(transactionToSave.siteID),
      siteAreaID: Utils.convertToObjectID(transactionToSave.siteAreaID),
      userID: Utils.convertToObjectID(transactionToSave.userID),
      ... transactionToSave
    };
    // Clean up mongo save object
    delete transactionMDB.id;
    if(transactionMDB.stop){
      delete transactionMDB.stop.user;
    }
    delete transactionMDB.chargeBox;
    delete transactionMDB.user;
    delete transactionMDB.lastUpdate;
    delete transactionMDB.currentConsumptionWh;

    // Modify
    await global.database.getCollection<any>(tenantID, 'transactions').findOneAndReplace(
      { '_id': Utils.convertToInt(transactionToSave.id) },
      transactionMDB,
      { upsert: true, returnOriginal: false });
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
    params:{search?:string,userId?:string,chargeBoxID?:string,siteAreaID?:string,siteID?:string,connectorId?:number,startTime?:Date,endTime?:Date,stop?:any,type?:'refunded'|'notRefunded',minimalPrice?:boolean,withChargeBoxes?:boolean,statistics?:'refund'|'history'},//TODO change the any
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
    if (params.search) {
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
        $in: params.userIDs.map((user) => {
          return Utils.convertToObjectID(user);
        })
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
        $in: params.siteAreaIDs.map((area) => {
          return Utils.convertToObjectID(area);
        })
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
    const aggregation = [];
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
        { tenantID, aggregation, localField: 'chargeBoxID', foreignField: '_id',
          asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false });
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
    // Add User that started the transaction
    DatabaseUtils.pushUserLookupInAggregation({ tenantID, aggregation, localField: 'userID', foreignField: '_id', asField: 'user',
      oneToOneCardinality: true, oneToOneCardinalityNotNull: false});
    // Add stop User
    DatabaseUtils.pushUserLookupInAggregation({ tenantID, aggregation, localField: 'stop.userID', foreignField: '_id', asField: 'stop.user',
      oneToOneCardinality: true, oneToOneCardinalityNotNull: false});
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const transactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Set
    const transactions = [];
    // Create
    if (transactionsMDB && transactionsMDB.length > 0) {
      // Create
      for (const transactionMDB of transactionsMDB) {
        transactions.push(transactionMDB);
      }
    }
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactions', uniqueTimerID, { params, dbParams });
    return {
      count: transactionCountMDB ? (transactionCountMDB.count === Constants.DB_RECORD_COUNT_CEIL ? -1 : transactionCountMDB.count) : 0,
      stats: transactionCountMDB ? transactionCountMDB : {},
      result: transactions
    };
  }

  static async getTransactionsInError(tenantID, params: any = {}, dbParams: DbParams) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactionsInError');
    // Check
    await Utils.checkTenant(tenantID);
    const pricing = await PricingStorage.getPricing(tenantID);

    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    const toSubRequests = [];
    // Build filter
    const match: any = {};
    // Filter?
    if (params.search) {
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
        $in: params.userIDs.map((user) => {
          return Utils.convertToObjectID(user);
        })
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
    if (params.siteAreaIDs) {
      match.siteAreaID = {
        $in: params.siteAreaIDs.map((area) => {
          return Utils.convertToObjectID(area);
        })
      };
    }
    if (params.siteID) {
      match.siteID = Utils.convertToObjectID(params.siteID);
    }
    // Filters
    if (match) {
      aggregation.push({
        $match: match
      });
    }
    // Transaction Duration Secs
    toSubRequests.push({
      $addFields: {
        'totalDurationSecs': { $divide: [{ $subtract: ['$stop.timestamp', '$timestamp'] }, 1000] },
        'idAsString': { $substr: ['$_id', 0, -1] }
      }
    });
    // Charger?
    if (params.withChargeBoxes) {
      // Add Charge Box
      toSubRequests.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, 'chargingstations'),
          localField: 'chargeBoxID',
          foreignField: '_id',
          as: 'chargeBox'
        }
      });
      // Single Record
      toSubRequests.push({
        $unwind: { 'path': '$chargeBox', 'preserveNullAndEmptyArrays': true }
      });
    }
    // Add User that started the transaction
    toSubRequests.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: 'userID',
        foreignField: '_id',
        as: 'user'
      }
    });
    // Single Record
    toSubRequests.push({
      $unwind: { 'path': '$user', 'preserveNullAndEmptyArrays': true }
    });
    // Add User that stopped the transaction
    toSubRequests.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: 'stop.userID',
        foreignField: '_id',
        as: 'stop.user'
      }
    });
    // Single Record
    toSubRequests.push({
      $unwind: { 'path': '$stop.user', 'preserveNullAndEmptyArrays': true }
    });

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
        'average_consumption_greater_than_connector_capacity':
          [
            { $match: { 'stop': { $exists: true } } },
            { $addFields: { activeDuration: { $subtract: ['$stop.totalDurationSecs', '$stop.totalInactivitySecs'] } } },
            { $match: { 'activeDuration': { $gt: 0 } } },
            {
              $lookup: {
                'from': DatabaseUtils.getCollectionName(tenantID, 'chargingstations'),
                'localField': 'chargeBoxID',
                'foreignField': '_id',
                'as': 'chargeBox'
              }
            },
            { $unwind: { 'path': '$chargeBox', 'preserveNullAndEmptyArrays': true } },
            { $addFields: { connector: { $arrayElemAt: ['$chargeBox.connectors', { $subtract: ['$connectorId', 1] }] } } },
            { $addFields: { averagePower: { $multiply: [{ $divide: ['$stop.totalConsumption', '$activeDuration'] }, 3600] } } },
            { $addFields: { impossiblePower: { $lte: [{ $subtract: ['$connector.power', '$averagePower'] }, 0] } } },
            { $match: { 'impossiblePower': { $eq: true } } },
            { $addFields: { 'errorCode': 'average_consumption_greater_than_connector_capacity' } }
          ]
      }
    };
    if (params.errorType) {
      const newFacet: any = {};
      newFacet[params.errorType] = facets.$facet[params.errorType];
      facets.$facet = newFacet;
    }

    // Merge in each facet the join for sitearea and siteareaid
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
    aggregation.push({ $addFields: { 'uniqueId': { $concat: ['$idAsString', '#', '$errorCode'] } } });
    // Limit records?
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
    // Sort
    if (dbParams.sort) {
      // Sort
      aggregation.push({
        $sort: dbParams.sort
      });
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
    // Read DB
    const transactionsMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 }, allowDiskUse: true })
      .toArray();
    // Set
    const transactions = [];
    // Create
    if (transactionsMDB && transactionsMDB.length > 0) {
      // Create
      for (const transactionMDB of transactionsMDB) {
        const transaction = new Transaction(tenantID, { ...transactionMDB, pricing: pricing });
        transaction.getModel().errorCode = transactionMDB.errorCode;
        transaction.getModel().uniqueId = transactionMDB.uniqueId;
        transactions.push(transaction);
      }
    }
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactionsInError', uniqueTimerID, { params, dbParams });
    // Ok
    return {
      count: (transactionCountMDB ? (transactionCountMDB.count === Constants.DB_RECORD_COUNT_CEIL ? -1 : transactionCountMDB.count) : 0),
      result: transactions
    };
  }

  public static async getTransaction(tenantID: string, id: number): Promise<{count: number, result: Transaction[]}> {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: { _id: Utils.convertToInt(id) }
    });
    // Add User
    DatabaseUtils.pushUserLookupInAggregation(
      { tenantID, aggregation, localField: 'userID', foreignField: '_id',
        asField: 'user', oneToOneCardinality: true, oneToOneCardinalityNotNull: false });
    // Add Stop User
    DatabaseUtils.pushUserLookupInAggregation(
      { tenantID, aggregation, localField: 'stop.userID', foreignField: '_id',
        asField: 'stop.user', oneToOneCardinality: true, oneToOneCardinalityNotNull: false });
    // Charging Station
    DatabaseUtils.pushChargingStationLookupInAggregation({ tenantID, aggregation, localField: 'chargeBoxID', foreignField: '_id',
        asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false })
    // Read DB
    const transactionsMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();

    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransaction', uniqueTimerID, { id });
    // Found?
    if (transactionsMDB && transactionsMDB.length > 0) {
      return new Transaction(tenantID, transactionsMDB[0]);
    }
    return null;
  }

  static async getActiveTransaction(tenantID, chargeBoxID, connectorId) {
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
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: 'userID',
        foreignField: '_id',
        as: 'user'
      }
    });
    // Add
    aggregation.push({
      $unwind: { 'path': '$user', 'preserveNullAndEmptyArrays': true }
    });
    // Read DB
    const transactionsMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd('TransactionStorage', 'getActiveTransaction', uniqueTimerID, { chargeBoxID, connectorId });
    // Found?
    if (transactionsMDB && transactionsMDB.length > 0) {
      return new Transaction(tenantID, transactionsMDB[0]);
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

  static async _findAvailableID(tenantID) { //TODO ...Why not just increment it??
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', '_findAvailableID');
    // Check
    await Utils.checkTenant(tenantID);
    let existingTransaction;
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
