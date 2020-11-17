import RefundReport, { RefundStatus } from '../../types/Refund';
import { TransactionInError, TransactionInErrorType } from '../../types/InError';
import global, { FilterParams } from './../../types/GlobalType';

import Constants from '../../utils/Constants';
import ConsumptionStorage from './ConsumptionStorage';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { NotifySessionNotStarted } from '../../types/Notification';
import { ServerAction } from '../../types/Server';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'TransactionStorage';

export default class TransactionStorage {
  public static async deleteTransaction(tenantID: string, transactionID: number): Promise<void> {
    await this.deleteTransactions(tenantID, [transactionID]);
  }

  public static async deleteTransactions(tenantID: string, transactionsIDs: number[]): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    const result = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .deleteMany({ '_id': { $in: transactionsIDs } });
    // Delete Meter Values
    await global.database.getCollection<any>(tenantID, 'metervalues')
      .deleteMany({ 'transactionId': { $in: transactionsIDs } });
    // Delete Consumptions
    await ConsumptionStorage.deleteConsumptions(tenantID, transactionsIDs);
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteTransaction', uniqueTimerID, { transactionsIDs });
    return result.deletedCount;
  }

  public static async saveTransaction(tenantID: string, transactionToSave: Transaction): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveTransaction');
    // Check
    await Utils.checkTenant(tenantID);
    // ID not provided?
    if (!transactionToSave.id) {
      transactionToSave.id = await TransactionStorage._findAvailableID(tenantID);
    }
    // Transfer
    const transactionMDB: any = {
      _id: Utils.convertToInt(transactionToSave.id),
      issuer: Utils.convertToBoolean(transactionToSave.issuer),
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
      lastConsumption: transactionToSave.lastConsumption,
      currentTotalInactivitySecs: Utils.convertToInt(transactionToSave.currentTotalInactivitySecs),
      currentInactivityStatus: transactionToSave.currentInactivityStatus,
      currentCumulatedPrice: Utils.convertToFloat(transactionToSave.currentCumulatedPrice),
      transactionEndReceived: Utils.convertToBoolean(transactionToSave.transactionEndReceived),
      currentInstantWatts: Utils.convertToFloat(transactionToSave.currentInstantWatts),
      currentInstantWattsL1: Utils.convertToFloat(transactionToSave.currentInstantWattsL1),
      currentInstantWattsL2: Utils.convertToFloat(transactionToSave.currentInstantWattsL2),
      currentInstantWattsL3: Utils.convertToFloat(transactionToSave.currentInstantWattsL3),
      currentInstantWattsDC: Utils.convertToFloat(transactionToSave.currentInstantWattsDC),
      currentTotalConsumptionWh: Utils.convertToFloat(transactionToSave.currentTotalConsumptionWh),
      currentTotalDurationSecs: Utils.convertToInt(transactionToSave.currentTotalDurationSecs),
      currentInstantVolts: Utils.convertToFloat(transactionToSave.currentInstantVolts),
      currentInstantVoltsL1: Utils.convertToInt(transactionToSave.currentInstantVoltsL1),
      currentInstantVoltsL2: Utils.convertToInt(transactionToSave.currentInstantVoltsL2),
      currentInstantVoltsL3: Utils.convertToInt(transactionToSave.currentInstantVoltsL3),
      currentInstantVoltsDC: Utils.convertToInt(transactionToSave.currentInstantVoltsDC),
      currentInstantAmps: Utils.convertToFloat(transactionToSave.currentInstantAmps),
      currentInstantAmpsL1: Utils.convertToInt(transactionToSave.currentInstantAmpsL1),
      currentInstantAmpsL2: Utils.convertToInt(transactionToSave.currentInstantAmpsL2),
      currentInstantAmpsL3: Utils.convertToInt(transactionToSave.currentInstantAmpsL3),
      currentInstantAmpsDC: Utils.convertToInt(transactionToSave.currentInstantAmpsDC),
    };
    if (transactionToSave.phasesUsed) {
      transactionMDB.phasesUsed = {
        csPhase1: Utils.convertToBoolean(transactionToSave.phasesUsed.csPhase1),
        csPhase2: Utils.convertToBoolean(transactionToSave.phasesUsed.csPhase2),
        csPhase3: Utils.convertToBoolean(transactionToSave.phasesUsed.csPhase3),
      };
    }
    if (transactionToSave.stop) {
      // Add stop
      transactionMDB.stop = {
        userID: Utils.convertToObjectID(transactionToSave.stop.userID),
        timestamp: Utils.convertToDate(transactionToSave.stop.timestamp),
        tagID: transactionToSave.stop.tagID,
        meterStop: transactionToSave.stop.meterStop,
        transactionData: transactionToSave.stop.transactionData,
        stateOfCharge: Utils.convertToInt(transactionToSave.stop.stateOfCharge),
        signedData: transactionToSave.stop.signedData,
        totalConsumptionWh: Utils.convertToFloat(transactionToSave.stop.totalConsumptionWh),
        totalInactivitySecs: Utils.convertToInt(transactionToSave.stop.totalInactivitySecs),
        extraInactivitySecs: Utils.convertToInt(transactionToSave.stop.extraInactivitySecs),
        extraInactivityComputed: !!transactionToSave.stop.extraInactivityComputed,
        inactivityStatus: transactionToSave.stop.inactivityStatus,
        totalDurationSecs: Utils.convertToInt(transactionToSave.stop.totalDurationSecs),
        price: Utils.convertToFloat(transactionToSave.stop.price),
        roundedPrice: Utils.convertToFloat(transactionToSave.stop.roundedPrice),
        priceUnit: transactionToSave.priceUnit,
        pricingSource: transactionToSave.stop.pricingSource
      };
      // Remove runtime props
      delete transactionMDB.currentInstantWatts;
      delete transactionMDB.currentInstantWattsL1;
      delete transactionMDB.currentInstantWattsL2;
      delete transactionMDB.currentInstantWattsL3;
      delete transactionMDB.currentInstantWattsDC;
      delete transactionMDB.currentCumulatedPrice;
      delete transactionMDB.currentSignedData;
      delete transactionMDB.currentStateOfCharge;
      delete transactionMDB.currentTotalConsumptionWh;
      delete transactionMDB.currentTotalInactivitySecs;
      delete transactionMDB.currentInactivityStatus;
      delete transactionMDB.lastConsumption;
      delete transactionMDB.numberOfMeterValues;
      delete transactionMDB.currentTotalDurationSecs;
      delete transactionMDB.currentInstantVolts;
      delete transactionMDB.currentInstantVoltsL1;
      delete transactionMDB.currentInstantVoltsL2;
      delete transactionMDB.currentInstantVoltsL3;
      delete transactionMDB.currentInstantVoltsDC;
      delete transactionMDB.currentInstantAmps;
      delete transactionMDB.transactionEndReceived;
      delete transactionMDB.currentInstantAmpsL1;
      delete transactionMDB.currentInstantAmpsL2;
      delete transactionMDB.currentInstantAmpsL3;
      delete transactionMDB.currentInstantAmpsDC;
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
        reportId: transactionToSave.refundData.reportId
      };
    }
    if (transactionToSave.billingData) {
      transactionMDB.billingData = {
        status: transactionToSave.billingData.status,
        invoiceID: Utils.convertToObjectID(transactionToSave.billingData.invoiceID),
        invoiceStatus: transactionToSave.billingData.invoiceStatus,
        invoiceItem: transactionToSave.billingData.invoiceItem,
        lastUpdate: Utils.convertToDate(transactionToSave.billingData.lastUpdate),
      };
    }
    if (transactionToSave.ocpiData) {
      transactionMDB.ocpiData = {
        session: transactionToSave.ocpiData.session,
        cdr: transactionToSave.ocpiData.cdr
      };
      if (transactionToSave.ocpiData.sessionCheckedOn) {
        transactionMDB.ocpiData.sessionCheckedOn = transactionToSave.ocpiData.sessionCheckedOn;
      }
      if (transactionToSave.ocpiData.cdrCheckedOn) {
        transactionMDB.ocpiData.cdrCheckedOn = transactionToSave.ocpiData.cdrCheckedOn;
      }
    }
    // Modify
    await global.database.getCollection<any>(tenantID, 'transactions').findOneAndReplace(
      { '_id': Utils.convertToInt(transactionToSave.id) },
      transactionMDB,
      { upsert: true });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveTransaction', uniqueTimerID, transactionMDB);
    // Return
    return transactionToSave.id;
  }

  public static async assignTransactionsToUser(tenantID: string, userID: string, tagID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'assignTransactionsToUser');
    // Assign transactions
    await global.database.getCollection(tenantID, 'transactions').updateMany({
      $and: [
        { 'userID': null },
        { 'tagID': tagID }
      ]
    }, {
      $set: {
        userID: Utils.convertToObjectID(userID)
      }
    });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'assignTransactionsToUser', uniqueTimerID);
  }

  public static async getUnassignedTransactionsCount(tenantID: string, tagID: string): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getUnassignedTransactionsCount');
    // Get the number of unassigned transactions
    const unassignedCount = await global.database.getCollection<Transaction>(tenantID, 'transactions').find({
      $and: [
        { 'userID': null },
        { 'tagID': tagID }
      ]
    }).count();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getUnassignedTransactionsCount', uniqueTimerID);
    return unassignedCount;
  }

  public static async getTransactionYears(tenantID: string): Promise<Date[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getTransactionYears');
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
    Logging.traceEnd(tenantID, MODULE_NAME, 'getTransactionYears', uniqueTimerID, firstTransactionsMDB);
    return transactionYears;
  }

  public static async getTransactions(tenantID: string,
    params: {
      transactionIDs?: number[]; issuer?: boolean; search?: string; ownerID?: string; userIDs?: string[]; siteAdminIDs?: string[];
      chargeBoxIDs?: string[]; siteAreaIDs?: string[]; siteIDs?: string[]; connectorId?: number; startDateTime?: Date;
      endDateTime?: Date; stop?: any; minimalPrice?: boolean; reportIDs?: string[]; tagIDs?: string[]; inactivityStatus?: string[];
      ocpiSessionID?: string; ocpiSessionDateFrom?: Date; ocpiSessionDateTo?: Date; ocpiCdrDateFrom?: Date; ocpiCdrDateTo?: Date;
      ocpiSessionChecked?: boolean; ocpiCdrChecked?: boolean;
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
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getTransactions');
    // Check
    await Utils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Build filter
    const ownerMatch = { $or: [] };
    const filters: FilterParams = {};
    // User / Site Admin
    if (params.ownerID) {
      ownerMatch.$or.push({
        userID: Utils.convertToObjectID(params.ownerID)
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
      // Build filter
      filters.$or = [
        { '_id': Utils.convertToInt(params.search) },
        { 'tagID': { $regex: params.search, $options: 'i' } },
        { 'chargeBoxID': { $regex: params.search, $options: 'i' } },
        { 'ocpiData.session.id': { $regex: params.search, $options: 'i' } }
      ];
    }
    // OCPI ID
    if (params.ocpiSessionID) {
      filters['ocpiData.session.id'] = params.ocpiSessionID;
    }
    // Transaction
    if (!Utils.isEmptyArray(params.transactionIDs)) {
      filters._id = {
        $in: params.transactionIDs
      };
    }
    // Issuer
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBooleanValue(params.issuer)) {
      filters.issuer = params.issuer;
    }
    // User
    if (params.userIDs) {
      filters.userID = { $in: params.userIDs.map((siteID) => Utils.convertToObjectID(siteID)) };
    }
    // Charge Box
    if (params.chargeBoxIDs) {
      filters.chargeBoxID = { $in: params.chargeBoxIDs };
    }
    // Tag
    if (params.tagIDs) {
      filters.tagID = { $in: params.tagIDs };
    }
    // Connector
    if (params.connectorId) {
      filters.connectorId = Utils.convertToInt(params.connectorId);
    }
    // Date provided?
    if (params.startDateTime || params.endDateTime) {
      filters.timestamp = {};
      // Start date
      if (params.startDateTime) {
        filters.timestamp.$gte = Utils.convertToDate(params.startDateTime);
      }
      // End date
      if (params.endDateTime) {
        filters.timestamp.$lte = Utils.convertToDate(params.endDateTime);
      }
    }
    // OCPI Session Date provided?
    if (params.ocpiSessionDateFrom || params.ocpiSessionDateTo) {
      // Start date
      if (params.ocpiSessionDateFrom) {
        filters['ocpiData.session.last_updated'] = { $gte: Utils.convertToDate(params.ocpiSessionDateFrom) };
      }
      // End date
      if (params.ocpiSessionDateTo) {
        filters['ocpiData.session.last_updated'] = { $lte: Utils.convertToDate(params.ocpiSessionDateTo) };
      }
    }
    if (params.ocpiSessionChecked === true || params.ocpiSessionChecked === false) {
      filters['ocpiData.session'] = { $exists: true };
      filters['ocpiData.sessionCheckedOn'] = { $exists: params.ocpiSessionChecked };
    }
    // OCPI Cdr Date provided?
    if (params.ocpiCdrDateFrom || params.ocpiCdrDateTo) {
      // Start date
      if (params.ocpiCdrDateFrom) {
        filters['ocpiData.cdr.last_updated'] = { $gte: Utils.convertToDate(params.ocpiCdrDateFrom) };
      }
      // End date
      if (params.ocpiCdrDateTo) {
        filters['ocpiData.cdr.last_updated'] = { $lte: Utils.convertToDate(params.ocpiCdrDateTo) };
      }
    }
    if (params.ocpiCdrChecked === true || params.ocpiCdrChecked === false) {
      filters['ocpiData.cdr'] = { $exists: true };
      filters['ocpiData.cdrCheckedOn'] = { $exists: params.ocpiCdrChecked };
    }
    // Check stop transaction
    if (params.stop) {
      filters.stop = params.stop;
    }
    // Inactivity Status
    if (params.inactivityStatus) {
      filters['stop.inactivityStatus'] = { $in: params.inactivityStatus };
    }
    // Site's area ID
    if (params.siteAreaIDs) {
      filters.siteAreaID = {
        $in: params.siteAreaIDs.map((siteAreaID) => Utils.convertToObjectID(siteAreaID))
      };
    }
    // Site ID
    if (params.siteIDs) {
      filters.siteID = {
        $in: params.siteIDs.map((siteID) => Utils.convertToObjectID(siteID))
      };
    }
    // Refund status
    if (params.refundStatus && params.refundStatus.length > 0) {
      const statuses = params.refundStatus.map((status) => status === RefundStatus.NOT_SUBMITTED ? null : status);
      filters['refundData.status'] = {
        $in: statuses
      };
    }
    // Minimal Price
    if (params.minimalPrice) {
      filters['stop.price'] = { $gt: Utils.convertToInt(params.minimalPrice) };
    }
    // Report ID
    if (params.reportIDs) {
      filters['refundData.reportId'] = { $in: params.reportIDs };
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (ownerMatch.$or && ownerMatch.$or.length > 0) {
      aggregation.push({
        $match: {
          $and: [ownerMatch, filters]
        }
      });
    } else {
      aggregation.push({
        $match: filters
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
            firstTimestamp: { $min: '$timestamp' },
            lastTimestamp: { $max: '$timestamp' },
            totalConsumptionWattHours: { $sum: '$stop.totalConsumptionWh' },
            totalDurationSecs: { $sum: '$stop.totalDurationSecs' },
            totalPrice: { $sum: '$stop.price' },
            totalInactivitySecs: { '$sum': { $add: ['$stop.totalInactivitySecs', '$stop.extraInactivitySecs'] } },
            currency: { $addToSet: '$stop.priceUnit' },
            count: { $sum: 1 }
          }
        };
        break;
      case 'refund': // For refund case
        statsQuery = {
          $group: {
            _id: null,
            firstTimestamp: { $min: '$timestamp' },
            lastTimestamp: { $max: '$timestamp' },
            totalConsumptionWattHours: { $sum: '$stop.totalConsumptionWh' },
            totalPriceRefund: { $sum: { $cond: [{ '$in': ['$refundData.status', [RefundStatus.SUBMITTED, RefundStatus.APPROVED]] }, '$stop.price', 0] } },
            totalPricePending: { $sum: { $cond: [{ '$in': ['$refundData.status', [RefundStatus.SUBMITTED, RefundStatus.APPROVED]] }, 0, '$stop.price'] } },
            countRefundTransactions: { $sum: { $cond: [{ '$in': ['$refundData.status', [RefundStatus.SUBMITTED, RefundStatus.APPROVED]] }, 1, 0] } },
            countPendingTransactions: { $sum: { $cond: [{ '$in': ['$refundData.status', [RefundStatus.SUBMITTED, RefundStatus.APPROVED]] }, 0, 1] } },
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
      .aggregate([...aggregation, statsQuery], { allowDiskUse: true })
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
    // Translate array response to number
    if (transactionCountMDB && transactionCountMDB.countRefundedReports) {
      transactionCountMDB.countRefundedReports = transactionCountMDB.countRefundedReports.length;
    }
    // Take first entry as reference currency. Expectation is that we have only one currency for all transaction
    if (transactionCountMDB && transactionCountMDB.currency) {
      transactionCountMDB.currency = transactionCountMDB.currency[0];
    }
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      Logging.traceEnd(tenantID, MODULE_NAME, 'getTransactions', uniqueTimerID, transactionCountMDB);
      return {
        count: transactionCountMDB ? transactionCountMDB.count : 0,
        stats: transactionCountMDB ? transactionCountMDB : {},
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { timestamp: -1 };
    }
    if (!dbParams.sort.timestamp) {
      aggregation.push({
        $sort: { ...dbParams.sort, timestamp: -1 }
      });
    } else {
      aggregation.push({
        $sort: dbParams.sort
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
    // Add if OCPI CDR exists
    if (projectFields && projectFields.includes('ocpiWithNoCdr')) {
      aggregation.push({
        $addFields: {
          ocpiWithNoCdr: {
            $cond: { if: { $and: [{ $gt: ['$ocpiData', null] }, { $not: { $gt: ['$ocpiData.cdr', null] } }] }, then: true, else: false }
          }
        }
      });
    }
    // Charge Box
    DatabaseUtils.pushChargingStationLookupInAggregation({
      tenantID, aggregation: aggregation, localField: 'chargeBoxID', foreignField: '_id',
      asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargeBox.siteAreaID');
    // Add Connector and Status
    if (projectFields && projectFields.includes('status')) {
      aggregation.push({
        $addFields: { connector: { $arrayElemAt: ['$chargeBox.connectors', { $subtract: ['$connectorId', 1] }] } }
      }, {
        $addFields: { status: '$connector.status' }
      });
    }
    // Users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID, aggregation: aggregation, asField: 'user', localField: 'userID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID, aggregation: aggregation, asField: 'stop.user', localField: 'stop.userID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Rename ID
    DatabaseUtils.pushRenameDatabaseIDToNumber(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'stop.userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'remotestop.userID');
    // Set to null
    DatabaseUtils.clearFieldValueIfSubFieldIsNull(aggregation, 'stop', 'timestamp');
    DatabaseUtils.clearFieldValueIfSubFieldIsNull(aggregation, 'remotestop', 'timestamp');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const transactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getTransactions', uniqueTimerID, transactionsMDB);
    return {
      count: transactionCountMDB ? (transactionCountMDB.count === Constants.DB_RECORD_COUNT_CEIL ? -1 : transactionCountMDB.count) : 0,
      stats: transactionCountMDB ? transactionCountMDB : {},
      result: transactionsMDB
    };
  }

  public static async getRefundReports(tenantID: string,
    params: { ownerID?: string; siteAdminIDs?: string[] },
    dbParams: DbParams, projectFields?: string[]): Promise<{ count: number; result: RefundReport[] }> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getTransactions');
    // Check
    await Utils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    const ownerMatch = { $or: [] };
    const filters = {};
    filters['refundData.reportId'] = { '$ne': null };
    if (params.ownerID) {
      ownerMatch.$or.push({
        userID: Utils.convertToObjectID(params.ownerID)
      });
    }
    if (params.siteAdminIDs) {
      ownerMatch.$or.push({
        siteID: {
          $in: params.siteAdminIDs.map((siteID) => Utils.convertToObjectID(siteID))
        }
      });
    }
    if (ownerMatch.$or && ownerMatch.$or.length > 0) {
      aggregation.push({
        $match: {
          $and: [
            ownerMatch, filters
          ]
        }
      });
    } else {
      aggregation.push({
        $match: filters
      });
    }
    aggregation.push({
      $group: {
        '_id': '$refundData.reportId',
        'userID': { '$first': '$userID' }
      }
    });
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Prepare statistics query
    const statsQuery = {
      $group: {
        _id: null,
        count: { $sum: 1 }
      }
    };
    // Count Records
    const transactionsCountMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate([...aggregation, statsQuery], { allowDiskUse: true })
      .toArray();
    let reportCountMDB = (transactionsCountMDB && transactionsCountMDB.length > 0) ? transactionsCountMDB[0] : null;
    // Initialize statistics
    if (!reportCountMDB) {
      reportCountMDB = {
        count: 0
      };
    }
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      Logging.traceEnd(tenantID, MODULE_NAME, 'getRefundReports', uniqueTimerID, reportCountMDB);
      return {
        count: reportCountMDB ? reportCountMDB.count : 0,
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Not yet possible to remove the fields if stop/remoteStop does not exist (MongoDB 4.2)
    // DatabaseUtils.pushConvertObjectIDToString(aggregation, 'stop.userID');
    // DatabaseUtils.pushConvertObjectIDToString(aggregation, 'remotestop.userID');
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { timestamp: -1 };
    }
    if (!dbParams.sort.timestamp) {
      aggregation.push({
        $sort: { ...dbParams.sort, timestamp: -1 }
      });
    } else {
      aggregation.push({
        $sort: dbParams.sort
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
    // Add respective users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID, aggregation: aggregation, asField: 'user', localField: 'userID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Rename ID
    DatabaseUtils.pushRenameDatabaseIDToNumber(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const reportsMDB = await global.database.getCollection<RefundReport>(tenantID, 'transactions')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getRefundReports', uniqueTimerID, reportsMDB);
    return {
      count: reportCountMDB ? (reportCountMDB.count === Constants.DB_RECORD_COUNT_CEIL ? -1 : reportCountMDB.count) : 0,
      result: reportsMDB
    };
  }

  static async getTransactionsInError(tenantID: string,
    params: {
      search?: string; issuer?: boolean; userIDs?: string[]; chargeBoxIDs?: string[];
      siteAreaIDs?: string[]; siteIDs?: string[]; startDateTime?: Date; endDateTime?: Date;
      withChargeBoxes?: boolean; errorType?: TransactionInErrorType[];
    }, projectFields?: string[]): Promise<DataResult<TransactionInError>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getTransactionsInError');
    // Check
    await Utils.checkTenant(tenantID);
    // Build filters
    const match: any = { stop: { $exists: true } };
    // Filter?
    if (params.search) {
      match.$or = [
        { '_id': Utils.convertToInt(params.search) },
        { 'tagID': { $regex: params.search, $options: 'i' } },
        { 'chargeBoxID': { $regex: params.search, $options: 'i' } }
      ];
    }
    // Issuer
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBooleanValue(params.issuer)) {
      match.issuer = params.issuer;
    }
    // User / Site Admin
    if (params.userIDs) {
      match.userID = { $in: params.userIDs.map((user) => Utils.convertToObjectID(user)) };
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
    if (params.siteIDs) {
      match.siteID = {
        $in: params.siteIDs.map((site) => Utils.convertToObjectID(site))
      };
    }
    // Create Aggregation
    const aggregation = [];
    aggregation.push({
      $match: match
    });
    // Charging Station?
    if (params.withChargeBoxes ||
      (params.errorType && params.errorType.includes(TransactionInErrorType.OVER_CONSUMPTION))) {
      // Add Charge Box
      DatabaseUtils.pushChargingStationLookupInAggregation({
        tenantID, aggregation: aggregation, localField: 'chargeBoxID', foreignField: '_id', asField: 'chargeBox',
        oneToOneCardinality: true, oneToOneCardinalityNotNull: false, pipelineMatch: { 'issuer': true }
      });
      DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargeBox.siteAreaID');
    }
    // Add respective users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID, aggregation: aggregation, asField: 'user', localField: 'userID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Used only in the error type : missing_user
    if (params.errorType && params.errorType.includes(TransactionInErrorType.MISSING_USER)) {
      // Site Area
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID, aggregation: aggregation, localField: 'siteAreaID', foreignField: '_id',
        asField: 'siteArea', oneToOneCardinality: true
      });
    }
    // Build facets for each type of error if any
    if (!Utils.isEmptyArray(params.errorType)) {
      const facets: any = { $facet: {} };
      const array = [];
      params.errorType.forEach((type) => {
        array.push(`$${type}`);
        facets.$facet[type] = this.getTransactionsInErrorFacet(type);
      });
      aggregation.push(facets);
      // Manipulate the results to convert it to an array of document on root level
      aggregation.push({ $project: { 'allItems': { $setUnion: array } } });
      aggregation.push({ $unwind: { 'path': '$allItems' } });
      aggregation.push({ $replaceRoot: { newRoot: '$allItems' } });
      // Add a unique identifier as we may have the same Charging Station several time
      aggregation.push({ $addFields: { 'uniqueId': { $concat: [{ $substr: ['$_id', 0, -1] }, '#', '$errorCode'] } } });
    }
    // Users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID, aggregation: aggregation, asField: 'stop.user', localField: 'stop.userID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Rename ID
    DatabaseUtils.pushRenameDatabaseIDToNumber(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'stop.userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'remotestop.userID');
    // Set to null
    DatabaseUtils.clearFieldValueIfSubFieldIsNull(aggregation, 'stop', 'timestamp');
    DatabaseUtils.clearFieldValueIfSubFieldIsNull(aggregation, 'remotestop', 'timestamp');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const transactionsMDB = await global.database.getCollection<any>(tenantID, 'transactions')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getTransactionsInError', uniqueTimerID, transactionsMDB);
    return {
      count: transactionsMDB.length,
      result: transactionsMDB
    };
  }

  public static async getTransaction(tenantID: string, id: number = Constants.UNKNOWN_NUMBER_ID,
    projectFields?: string[]): Promise<Transaction> {
    const transactionsMDB = await TransactionStorage.getTransactions(tenantID, {
      transactionIDs: [id]
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return transactionsMDB.count === 1 ? transactionsMDB.result[0] : null;
  }

  public static async getOCPITransaction(tenantID: string, sessionID: string): Promise<Transaction> {
    const transactionsMDB = await TransactionStorage.getTransactions(tenantID, { ocpiSessionID: sessionID }, Constants.DB_PARAMS_SINGLE_RECORD);
    return transactionsMDB.count === 1 ? transactionsMDB.result[0] : null;
  }

  public static async getActiveTransaction(tenantID: string, chargeBoxID: string, connectorId: number): Promise<Transaction> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getActiveTransaction');
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
    DatabaseUtils.pushRenameDatabaseIDToNumber(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'stop.userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'remotestop.userID');
    // Set to null
    DatabaseUtils.clearFieldValueIfSubFieldIsNull(aggregation, 'stop', 'timestamp');
    DatabaseUtils.clearFieldValueIfSubFieldIsNull(aggregation, 'remotestop', 'timestamp');
    // Read DB
    const transactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getActiveTransaction', uniqueTimerID, transactionsMDB);
    return transactionsMDB.length === 1 ? transactionsMDB[0] : null;
  }

  public static async getLastTransaction(tenantID: string, chargeBoxID: string, connectorId: number,
    params: { withChargingStation?: boolean; withUser?: boolean; }): Promise<Transaction> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getLastTransaction');
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
    // Sort
    aggregation.push({
      $sort: {
        timestamp: -1
      }
    });
    // The last one
    aggregation.push({
      $limit: 1
    });
    // Add Charging Station
    if (params.withChargingStation) {
      DatabaseUtils.pushChargingStationLookupInAggregation({
        tenantID, aggregation: aggregation, localField: 'chargeBoxID', foreignField: '_id',
        asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
    }
    // Add User
    if (params.withUser) {
      DatabaseUtils.pushUserLookupInAggregation({
        tenantID, aggregation: aggregation, localField: 'userID', foreignField: '_id',
        asField: 'user', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
    }
    // Rename ID
    DatabaseUtils.pushRenameDatabaseIDToNumber(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteAreaID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'stop.userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'remotestop.userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargeBox.siteAreaID');
    // Set to null
    DatabaseUtils.clearFieldValueIfSubFieldIsNull(aggregation, 'stop', 'timestamp');
    DatabaseUtils.clearFieldValueIfSubFieldIsNull(aggregation, 'remotestop', 'timestamp');
    // Read DB
    const transactionsMDB = await global.database.getCollection<Transaction>(tenantID, 'transactions')
      .aggregate(aggregation, { allowDiskUse: true })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getLastTransaction', uniqueTimerID, transactionsMDB);
    return transactionsMDB.length === 1 ? transactionsMDB[0] : null;
  }

  public static async _findAvailableID(tenantID: string): Promise<number> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, '_findAvailableID');
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
          module: MODULE_NAME, method: '_findAvailableID',
          action: ServerAction.TRANSACTION_STARTED,
          message: `Transaction ID '${id}' already exists, generating a new one...`
        });
      } else {
        return id;
      }
    } while (existingTransaction);
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, '_findAvailableID', uniqueTimerID);
  }

  public static async getNotStartedTransactions(tenantID: string,
    params: { checkPastAuthorizeMins: number; sessionShouldBeStartedAfterMins: number }): Promise<DataResult<NotifySessionNotStarted>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getNotStartedTransactions');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Compute the date some minutes ago
    const authorizeStartDate = moment().subtract(params.checkPastAuthorizeMins, 'minutes').toDate();
    const authorizeEndDate = moment().subtract(params.sessionShouldBeStartedAfterMins, 'minutes').toDate();
    // Create Aggregation
    const aggregation = [];
    // Authorization window
    aggregation.push({
      $match: {
        timestamp: {
          $gt: Utils.convertToDate(authorizeStartDate),
          $lt: Utils.convertToDate(authorizeEndDate)
        }
      }
    });
    // Group by tagID
    aggregation.push({
      $group: {
        _id: '$tagID',
        authDate: {
          $last: '$timestamp'
        },
        chargeBoxID: {
          $last: '$chargeBoxID'
        },
        userID: {
          $last: '$userID'
        }
      }
    });
    // Add number of mins
    aggregation.push({
      $addFields: {
        dateStart: {
          $toDate: { $subtract: [{ $toLong: '$authDate' }, 5 * 60 * 1000] }
        },
        dateEnd: {
          $toDate: { $add: [{ $toLong: '$authDate' }, params.sessionShouldBeStartedAfterMins * 60 * 1000] }
        }
      }
    });
    // Lookup for transactions
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'transactions'),
        let: { tagID: '$_id', dateStart: '$dateStart', dateEnd: '$dateEnd' },
        pipeline: [{
          $match: {
            $or: [
              {
                $and: [
                  { $expr: { $eq: ['$tagID', '$$tagID'] } },
                  { $expr: { $gt: ['$timestamp', '$$dateStart'] } },
                  { $expr: { $lt: ['$timestamp', '$$dateEnd'] } }
                ]
              },
              {
                $and: [
                  { $expr: { $eq: ['$stop.tagID', '$$tagID'] } },
                  { $expr: { $gt: ['$stop.timestamp', '$$dateStart'] } },
                  { $expr: { $lt: ['$stop.timestamp', '$$dateEnd'] } }
                ]
              },
            ]
          }
        }],
        as: 'transaction'
      }
    });
    // Get only authorize with no transactions
    aggregation.push({
      $match: {
        transaction: { $size: 0 }
      }
    });
    // Lookup for users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID, aggregation, localField: 'userID', foreignField: '_id',
      asField: 'user', oneToOneCardinality: true, oneToOneCardinalityNotNull: true
    });
    // Lookup for charging station
    DatabaseUtils.pushChargingStationLookupInAggregation({
      tenantID, aggregation, localField: 'chargeBoxID', foreignField: '_id',
      asField: 'chargingStation', oneToOneCardinality: true, oneToOneCardinalityNotNull: true
    });
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargingStation.siteAreaID');
    // Format Data
    aggregation.push({
      $project: {
        _id: 0,
        tagID: '$_id',
        authDate: '$dateStart',
        chargingStation: 1,
        user: 1
      }
    });
    // Read DB
    const notifySessionNotStartedMDB: NotifySessionNotStarted[] =
      await global.database.getCollection<NotifySessionNotStarted>(tenantID, 'authorizes')
        .aggregate(aggregation, { collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 } })
        .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getNotStartedTransactions', uniqueTimerID, notifySessionNotStartedMDB);
    return {
      count: notifySessionNotStartedMDB.length,
      result: notifySessionNotStartedMDB
    };
  }

  private static getTransactionsInErrorFacet(errorType: string) {
    switch (errorType) {
      case TransactionInErrorType.LONG_INACTIVITY:
        return [
          { $addFields: { 'totalInactivity': { $add: ['$stop.totalInactivitySecs', '$stop.extraInactivitySecs'] } } },
          { $match: { 'totalInactivity': { $gte: 86400 } } },
          { $addFields: { 'errorCode': TransactionInErrorType.LONG_INACTIVITY } }
        ];
      case TransactionInErrorType.NO_CONSUMPTION:
        return [
          { $match: { 'stop.totalConsumptionWh': { $lte: 0 } } },
          { $addFields: { 'errorCode': TransactionInErrorType.NO_CONSUMPTION } }
        ];
      case TransactionInErrorType.NEGATIVE_ACTIVITY:
        return [
          {
            $match: {
              $or: [
                { 'stop.totalInactivitySecs': { $lt: 0 } },
                { 'stop.extraInactivitySecs': { $lt: 0 } },
              ]
            }
          },
          { $addFields: { 'errorCode': TransactionInErrorType.NEGATIVE_ACTIVITY } }
        ];
      case TransactionInErrorType.NEGATIVE_DURATION:
        return [
          { $match: { 'stop.totalDurationSecs': { $lt: 0 } } },
          { $addFields: { 'errorCode': TransactionInErrorType.NEGATIVE_DURATION } }
        ];
      case TransactionInErrorType.INVALID_START_DATE:
        return [
          { $match: { 'timestamp': { $lte: Utils.convertToDate('2017-01-01 00:00:00.000Z') } } },
          { $addFields: { 'errorCode': TransactionInErrorType.INVALID_START_DATE } }
        ];
      case TransactionInErrorType.OVER_CONSUMPTION:
        return [
          { $addFields: { activeDuration: { $subtract: ['$stop.totalDurationSecs', '$stop.totalInactivitySecs'] } } },
          { $match: { 'activeDuration': { $gt: 0 } } },
          { $addFields: { connector: { $arrayElemAt: ['$chargeBox.connectors', { $subtract: ['$connectorId', 1] }] } } },
          { $addFields: { averagePower: { $abs: { $multiply: [{ $divide: ['$stop.totalConsumptionWh', '$activeDuration'] }, 3600] } } } },
          { $addFields: { impossiblePower: { $lte: [{ $subtract: [{ $multiply: ['$connector.power', 1.10] }, '$averagePower'] }, 0] } } },
          { $match: { 'impossiblePower': { $eq: true } } },
          { $addFields: { 'errorCode': TransactionInErrorType.OVER_CONSUMPTION } }
        ];
      case TransactionInErrorType.MISSING_PRICE:
        return [
          { $match: { 'stop.price': { $lte: 0 } } },
          { $match: { 'stop.totalConsumptionWh': { $gt: 0 } } },
          { $addFields: { 'errorCode': TransactionInErrorType.MISSING_PRICE } }
        ];
      case TransactionInErrorType.MISSING_USER:
        return [
          {
            $match: {
              $and: [
                {
                  $or: [
                    { 'userID': null },
                    { 'user': null },
                  ]
                },
                { 'siteArea.accessControl': { '$eq': true } }
              ]
            }
          },
          { $addFields: { 'errorCode': TransactionInErrorType.MISSING_USER } }
        ];
      case TransactionInErrorType.NO_BILLING_DATA:
        return [
          {
            $match: {
              $or: [
                { 'billingData': { $exists: false } },
                { 'billingData.invoiceID': { $exists: false } },
                { 'billingData.invoiceID': { $eq: null } }
              ]
            }
          },
          { $addFields: { 'errorCode': TransactionInErrorType.NO_BILLING_DATA } }
        ];
      default:
        return [];
    }
  }
}
