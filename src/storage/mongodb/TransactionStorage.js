const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const DatabaseUtils = require('./DatabaseUtils');
const Utils = require('../../utils/Utils');
const crypto = require('crypto');
const Logging = require('../../utils/Logging');
const PricingStorage = require('./PricingStorage');

class TransactionStorage {
  static async deleteTransaction(tenantID, transaction) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'deleteTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection(tenantID, 'transactions')
      .findOneAndDelete({'_id': transaction.getID()});
    // Delete Meter Values
    await global.database.getCollection(tenantID, 'metervalues')
      .deleteMany({'transactionId': transaction.getID()});
    // Delete Consumptions
    await global.database.getCollection(tenantID, 'consumptions')
      .deleteMany({'transactionId': transaction.getID()});
    // Debug
    Logging.traceEnd('TransactionStorage', 'deleteTransaction', uniqueTimerID, {transaction});
  }

  static async saveTransaction(tenantID, transactionToSave) {
    const Transaction = require('../../entity/Transaction');
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
    const transactionMDB = {};
    Database.updateTransaction(transactionToSave, transactionMDB, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'transactions').findOneAndReplace(
      {"_id": Utils.convertToInt(transactionToSave.id)},
      transactionMDB,
      {upsert: true, new: true, returnOriginal: false});
    // Debug
    Logging.traceEnd('TransactionStorage', 'saveTransaction', uniqueTimerID, {transactionToSave});
    // Return
    return new Transaction(tenantID, result.value);
  }

  static async saveMeterValues(tenantID, meterValuesToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'saveMeterValues');
    // Check
    await Utils.checkTenant(tenantID);
    const meterValuesMDB = [];
    // Save all
    for (const meterValueToSave of meterValuesToSave.values) {
      const meterValue = {};
      // Id
      meterValue._id = crypto.createHash('sha256')
        .update(`${meterValueToSave.chargeBoxID}~${meterValueToSave.connectorId}~${meterValueToSave.timestamp}~${meterValueToSave.value}~${JSON.stringify(meterValueToSave.attribute)}`)
        .digest("hex");
      // Set
      Database.updateMeterValue(meterValueToSave, meterValue, false);
      // Add
      meterValuesMDB.push(meterValue);
    }
    // Execute
    await global.database.getCollection(tenantID, 'metervalues').insertMany(meterValuesMDB);
    // Debug
    Logging.traceEnd('TransactionStorage', 'saveMeterValues', uniqueTimerID, {meterValuesToSave});
  }

  static async getTransactionYears(tenantID) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactionYears');
    // Check
    await Utils.checkTenant(tenantID);
    const firstTransactionsMDB = await global.database.getCollection(tenantID, 'transactions')
      .find({})
      .sort({timestamp: 1})
      .limit(1)
      .toArray();
    // Found?
    if (!firstTransactionsMDB || firstTransactionsMDB.length == 0) {
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

  static async getTransactions(tenantID, params = {}, limit, skip, sort) {
    const Transaction = require('../../entity/Transaction');
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactions');
    // Check
    await Utils.checkTenant(tenantID);
    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Build filter
    const match = {};
    // Filter?
    if (params.search) {
      // Build filter
      match.$or = [
        {"_id": parseInt(params.search)},
        {"tagID": {$regex: params.search, $options: 'i'}},
        {"chargeBoxID": {$regex: params.search, $options: 'i'}}
      ];
    }
    // User
    if (params.userId) {
      match.userID = Utils.convertToObjectID(params.userId);
    }
    // Charge Box
    if (params.chargeBoxID) {
      match.chargeBoxID = params.chargeBoxID;
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
    // Check stop tr
    if (params.stop) {
      match.stop = params.stop;
    }
    if (params.type) {
      switch (params.type) {
        case 'refunded':
          match.refundData = {$exists: true};
          break;
        case 'notRefunded':
          match.refundData = {$exists: false};
          break;
      }
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (match) {
      aggregation.push({
        $match: match
      });
    }
    // Transaction Duration Secs
    aggregation.push({
      $addFields: {
        "totalDurationSecs": {$divide: [{$subtract: ["$stop.timestamp", "$timestamp"]}, 1000]}
      }
    });
    // Charger?
    if (params.withChargeBoxes || params.siteID || params.siteAreaID) {
      // Add Charge Box
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, 'chargingstations'),
          localField: 'chargeBoxID',
          foreignField: '_id',
          as: 'chargeBox'
        }
      });
      // Single Record
      aggregation.push({
        $unwind: {"path": "$chargeBox", "preserveNullAndEmptyArrays": true}
      });
    }
    if (params.siteAreaID) {
      aggregation.push({
        $match: {"chargeBox.siteAreaID": Utils.convertToObjectID(params.siteAreaID)}
      });
    }
    if (params.siteID) {
      // Add Site Area
      aggregation.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, 'siteareas'),
          localField: 'chargeBox.siteAreaID',
          foreignField: '_id',
          as: 'siteArea'
        }
      });
      // Single Record
      aggregation.push({
        $unwind: {"path": "$siteArea", "preserveNullAndEmptyArrays": true}
      });
      // Filter
      aggregation.push({
        $match: {"siteArea.siteID": Utils.convertToObjectID(params.siteID)}
      });
    }
    // Count Records
    const transactionsCountMDB = await global.database.getCollection(tenantID, 'transactions')
      .aggregate([...aggregation, {$count: "count"}])
      .toArray();
    // Sort
    if (sort) {
      if (!sort.hasOwnProperty('timestamp')) {
        aggregation.push({
          $sort: {...sort, timestamp: -1}
        });
      } else {
        aggregation.push({
          $sort: sort
        });
      }
      // Sort
    } else {
      // Default
      aggregation.push({
        $sort: {timestamp: -1}
      });
    }
    // Skip
    aggregation.push({
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });
    // Add User that started the transaction
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: 'userID',
        foreignField: '_id',
        as: 'user'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: {"path": "$user", "preserveNullAndEmptyArrays": true}
    });
    // Add User that stopped the transaction
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: 'stop.userID',
        foreignField: '_id',
        as: 'stop.user'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: {"path": "$stop.user", "preserveNullAndEmptyArrays": true}
    });
    // Read DB
    const transactionsMDB = await global.database.getCollection(tenantID, 'transactions')
      .aggregate(aggregation, {collation: {locale: Constants.DEFAULT_LOCALE, strength: 2}})
      .toArray();
    // Set
    const transactions = [];
    // Create
    if (transactionsMDB && transactionsMDB.length > 0) {
      // Create
      for (const transactionMDB of transactionsMDB) {
        transactions.push(new Transaction(tenantID, transactionMDB));
      }
    }
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactions', uniqueTimerID, {params, limit, skip, sort});
    // Ok
    return {
      count: (transactionsCountMDB.length > 0 ? transactionsCountMDB[0].count : 0),
      result: transactions
    };
  }

  static async getTransactionsInError(tenantID, params = {}, limit, skip, sort) {
    const Transaction = require('../../entity/Transaction');
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransactions');
    // Check
    await Utils.checkTenant(tenantID);
    const pricing = await PricingStorage.getPricing(tenantID);

    // Check Limit
    limit = Utils.checkRecordLimit(limit);
    // Check Skip
    skip = Utils.checkRecordSkip(skip);
    // Create Aggregation
    const aggregation = [];
    const toSubRequests = [];
    // Build filter
    const match = {};
    // Filter?
    if (params.search) {
      // Build filter
      match.$or = [
        {"_id": parseInt(params.search)},
        {"tagID": {$regex: params.search, $options: 'i'}},
        {"chargeBoxID": {$regex: params.search, $options: 'i'}}
      ];
    }
    // User
    if (params.userId) {
      match.userID = Utils.convertToObjectID(params.userId);
    }
    // Charge Box
    if (params.chargeBoxID) {
      match.chargeBoxID = params.chargeBoxID;
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
    // Filters
    if (match) {
      aggregation.push({
        $match: match
      });
    }
    // Transaction Duration Secs
    toSubRequests.push({
      $addFields: {
        "totalDurationSecs": {$divide: [{$subtract: ["$stop.timestamp", "$timestamp"]}, 1000]},
        "idAsString": {$substr: ["$_id", 0, -1]}
      }
    });
    // Charger?
    if (params.withChargeBoxes || params.siteID) {
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
        $unwind: {"path": "$chargeBox", "preserveNullAndEmptyArrays": true}
      });
    }
    if (params.siteID) {
      // Add Site Area
      toSubRequests.push({
        $lookup: {
          from: DatabaseUtils.getCollectionName(tenantID, 'siteareas'),
          localField: 'chargeBox.siteAreaID',
          foreignField: '_id',
          as: 'siteArea'
        }
      });
      // Single Record
      toSubRequests.push({
        $unwind: {"path": "$siteArea", "preserveNullAndEmptyArrays": true}
      });
      // Filter
      toSubRequests.push({
        $match: {"siteArea.siteID": Utils.convertToObjectID(params.siteID)}
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
      $unwind: {"path": "$user", "preserveNullAndEmptyArrays": true}
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
      $unwind: {"path": "$stop.user", "preserveNullAndEmptyArrays": true}
    });

    const facets = {
      "$facet":
        {
          "noConsumption":
            [{
              $match: {
                $and: [
                  {"stop": {$exists: true}}, {"stop.totalConsumption": {$lte: 0}}
                ]
              }
            },
            { $addFields: {"errorCode": "noConsumption"} }
            ]
        }
    };

    // merge in each facet the join for sitearea and siteareaid
    const facetNames = [];
    for (const facet in facets.$facet) {
      // for(const subRequest of toSubRequests){
      facets.$facet[facet] = [...facets.$facet[facet], ...toSubRequests];
      // }
      facetNames.push(`$${facet}`);
    }
    aggregation.push(facets);
    // Manipulate the results to convert it to an array of document on root level
    aggregation.push({$project: {"allItems": {$concatArrays: facetNames}}});
    aggregation.push({"$unwind": {"path": "$allItems"}});
    aggregation.push({$replaceRoot: {newRoot: "$allItems"}});
    // Add a unique identifier as we may have the same charger several time
    aggregation.push({$addFields: {"uniqueId": {$concat: ["$idAsString", "#", "$errorCode"]}}});
    // Count Records
    const transactionsCountMDB = await global.database.getCollection(tenantID, 'transactions')
      .aggregate([...aggregation, {$count: "count"}])
      .toArray();
    // Sort
    if (sort) {
      // Sort
      aggregation.push({
        $sort: sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: {timestamp: -1}
      });
    }
    // Skip
    aggregation.push({
      $skip: skip
    });
    // Limit
    aggregation.push({
      $limit: limit
    });
    // Read DB
    const transactionsMDB = await global.database.getCollection(tenantID, 'transactions')
      .aggregate(aggregation, {collation: {locale: Constants.DEFAULT_LOCALE, strength: 2}})
      .toArray();
    // Set
    const transactions = [];
    // Create
    if (transactionsMDB && transactionsMDB.length > 0) {
      // Create
      for (const transactionMDB of transactionsMDB) {
        const transaction = new Transaction(tenantID, {...transactionMDB, pricing: pricing});
        transaction.getModel().errorCode = transactionMDB.errorCode;
        transaction.getModel().uniqueId = transactionMDB.uniqueId;
        transactions.push(transaction);
      }
    }
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransactions', uniqueTimerID, {params, limit, skip, sort});
    // Ok
    return {
      count: (transactionsCountMDB.length > 0 ? transactionsCountMDB[0].count : 0),
      result: transactions
    };
  }

  /**
   *
   * @param tenantID
   * @param id
   * @param withMeterValues
   * @returns {Promise<Transaction>}
   */
  static async getTransaction(tenantID, id) {
    const Transaction = require('../../entity/Transaction');
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {_id: Utils.convertToInt(id)}
    });
    // Add User
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: "userID",
        foreignField: "_id",
        as: "user"
      }
    });
    // Add
    aggregation.push({
      $unwind: {"path": "$user", "preserveNullAndEmptyArrays": true}
    });
    // Add Stop User
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: "stop.userID",
        foreignField: "_id",
        as: "stop.user"
      }
    });
    // Add
    aggregation.push({
      $unwind: {"path": "$stop.user", "preserveNullAndEmptyArrays": true}
    });
    // Charging Station
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'chargingstations'),
        localField: 'chargeBoxID',
        foreignField: '_id',
        as: 'chargeBox'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: {"path": "$chargeBox", "preserveNullAndEmptyArrays": true}
    });
    // Read DB
    const transactionsMDB = await global.database.getCollection(tenantID, 'transactions')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd('TransactionStorage', 'getTransaction', uniqueTimerID, {id});
    // Found?
    if (transactionsMDB && transactionsMDB.length > 0) {
      return new Transaction(tenantID, transactionsMDB[0]);
    }
    return null;
  }

  /**
   *
   * @param tenantID
   * @param transactionID
   * @returns {Promise<Array>}
   */
  static async getMeterValues(tenantID, transactionID) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getMeterValues');
    // Check
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {transactionId: Utils.convertToInt(transactionID)}
    });
    // Read DB
    const meterValuesMDB = await global.database.getCollection(tenantID, 'metervalues')
      .aggregate(aggregation)
      .toArray();
    // Convert to date
    for (const meterValueMDB of meterValuesMDB) {
      meterValueMDB.timestamp = new Date(meterValueMDB.timestamp);
    }
    // Sort
    meterValuesMDB.sort((meterValue1, meterValue2) => meterValue1.timestamp.getTime() - meterValue2.timestamp.getTime());
    // Create
    const meterValues = [];
    for (const meterValueMDB of meterValuesMDB) {
      const meterValue = {};
      // Copy
      Database.updateMeterValue(meterValueMDB, meterValue);
      // Add
      meterValues.push(meterValue);
    }
    // Debug
    Logging.traceEnd('TransactionStorage', 'getMeterValues', uniqueTimerID, {transactionID});
    return meterValues;
  }

  static async getActiveTransaction(tenantID, chargeBoxID, connectorId) {
    const Transaction = require('../../entity/Transaction');
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'getActiveTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        "chargeBoxID": chargeBoxID,
        "connectorId": Utils.convertToInt(connectorId),
        "stop": {$exists: false}
      }
    });
    // Add User
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: "userID",
        foreignField: "_id",
        as: "user"
      }
    });
    // Add
    aggregation.push({
      $unwind: {"path": "$user", "preserveNullAndEmptyArrays": true}
    });
    // Read DB
    const transactionsMDB = await global.database.getCollection(tenantID, 'transactions')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd('TransactionStorage', 'getActiveTransaction', uniqueTimerID, {chargeBoxID, connectorId});
    // Found?
    if (transactionsMDB && transactionsMDB.length > 0) {
      return new Transaction(tenantID, transactionsMDB[0]);
    }
    return null;
  }

  static async _findAvailableID(tenantID) {
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
          module: "TransactionStorage",
          method: "_findAvailableID", action: `nextID`,
          message: `Transaction ID '${id}' already exists, generating a new one...`
        });
      } else {
        return id;
      }
    } while (existingTransaction);
    // Debug
    Logging.traceEnd('TransactionStorage', '_findAvailableID', uniqueTimerID);
  }

  static async cleanupRemainingActiveTransactions(tenantID, chargeBoxId, connectorId) {
    // Debug
    const uniqueTimerID = Logging.traceStart('TransactionStorage', 'cleanupRemainingActiveTransactions');
    // Check
    await Utils.checkTenant(tenantID);
    let activeTransaction;
    do {
      // Check if the charging station has already a transaction
      activeTransaction = await TransactionStorage.getActiveTransaction(tenantID, chargeBoxId, connectorId);
      // Exists already?
      if (activeTransaction) {
        // Has consumption?
        if (activeTransaction.getCurrentTotalConsumption() <= 0) {
          // No consumption: delete
          Logging.logError({
            tenantID: tenantID,
            source: chargeBoxId, module: 'ChargingStation', method: 'cleanupRemainingActiveTransactions',
            action: 'StartTransaction', actionOnUser: activeTransaction.getUserID(),
            message: `Active Transaction ID '${activeTransaction.getID()}' has been deleted on Connector '${activeTransaction.getConnectorId()}'`
          });
          // Delete
          await this.deleteTransaction(tenantID, activeTransaction);
        } else {
          // Has consumption: close it!
          Logging.logWarning({
            tenantID: tenantID,
            source: chargeBoxId, module: 'ChargingStation', method: 'cleanupRemainingActiveTransactions',
            action: 'StartTransaction', actionOnUser: activeTransaction.getUserID(),
            message: `Active Transaction ID '${activeTransaction.getID()}' has been closed on Connector '${activeTransaction.getConnectorId()}'`
          });
          // Stop
          await activeTransaction.stopTransaction(activeTransaction.getUserID(), activeTransaction.getTagID(),
            activeTransaction.getLastMeterValue().value + 1, new Date());
          // Save Transaction
          await TransactionStorage.saveTransaction(activeTransaction.getTenantID(), activeTransaction.getModel());
        }
      }
    } while (activeTransaction);
    // Debug
    Logging.traceEnd('TransactionStorage', 'cleanupRemainingActiveTransactions', uniqueTimerID, {
      chargeBoxId,
      connectorId
    });
  }
}

module.exports = TransactionStorage;
