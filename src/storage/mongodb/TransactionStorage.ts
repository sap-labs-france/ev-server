import { BillingStatus, TransactionBillingData } from '../../types/Billing';
import { DataResult, TransactionDataResult, TransactionInErrorDataResult } from '../../types/DataResult';
import RefundReport, { RefundStatus, TransactionRefundData } from '../../types/Refund';
import Transaction, { CollectedFundReport, TransactionOcpiData, TransactionOicpData, TransactionStatisticsType, TransactionStats, TransactionStatus } from '../../types/Transaction';
import { TransactionInError, TransactionInErrorType } from '../../types/InError';
import global, { FilterParams } from './../../types/GlobalType';

import Constants from '../../utils/Constants';
import ConsumptionStorage from './ConsumptionStorage';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { NotifySessionNotStarted } from '../../types/UserNotifications';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import { UpdateResult } from 'mongodb';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'TransactionStorage';

export default class TransactionStorage {
  public static async deleteTransaction(tenant: Tenant, transactionID: number): Promise<void> {
    await TransactionStorage.deleteTransactions(tenant, [transactionID]);
  }

  public static async deleteTransactions(tenant: Tenant, transactionsIDs: number[]): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    const result = await global.database.getCollection<any>(tenant.id, 'transactions')
      .deleteMany({ '_id': { $in: transactionsIDs } });
    // Delete Meter Values
    await global.database.getCollection<any>(tenant.id, 'metervalues')
      .deleteMany({ 'transactionId': { $in: transactionsIDs } });
    // Delete Consumptions
    await ConsumptionStorage.deleteConsumptions(tenant, transactionsIDs);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteTransaction', startTime, { transactionsIDs });
    return result.deletedCount;
  }

  public static async saveTransaction(tenant: Tenant, transactionToSave: Transaction): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // ID not provided?
    if (!transactionToSave.id) {
      transactionToSave.id = await TransactionStorage.findAvailableID(tenant);
    }
    // Transfer
    const transactionMDB: any = {
      _id: Utils.convertToInt(transactionToSave.id),
      issuer: Utils.convertToBoolean(transactionToSave.issuer),
      companyID: DatabaseUtils.convertToObjectID(transactionToSave.companyID),
      siteID: DatabaseUtils.convertToObjectID(transactionToSave.siteID),
      siteAreaID: DatabaseUtils.convertToObjectID(transactionToSave.siteAreaID),
      connectorId: Utils.convertToInt(transactionToSave.connectorId),
      tagID: transactionToSave.tagID,
      carID: transactionToSave.carID ? DatabaseUtils.convertToObjectID(transactionToSave.carID) : null,
      carCatalogID: transactionToSave.carCatalogID ? Utils.convertToInt(transactionToSave.carCatalogID) : null,
      carStateOfCharge: Utils.convertToInt(transactionToSave.carStateOfCharge),
      carOdometer: Utils.convertToInt(transactionToSave.carOdometer),
      departureTime: Utils.convertToDate(transactionToSave.departureTime),
      targetStateOfCharge: Utils.convertToInt(transactionToSave.targetStateOfCharge),
      userID: DatabaseUtils.convertToObjectID(transactionToSave.userID),
      chargeBoxID: transactionToSave.chargeBoxID,
      meterStart: Utils.convertToInt(transactionToSave.meterStart),
      timestamp: Utils.convertToDate(transactionToSave.timestamp),
      price: Utils.convertToFloat(transactionToSave.price),
      roundedPrice: Utils.convertToFloat(transactionToSave.roundedPrice),
      priceUnit: transactionToSave.priceUnit,
      pricingSource: transactionToSave.pricingSource,
      pricingModel: transactionToSave.pricingModel,
      stateOfCharge: Utils.convertToInt(transactionToSave.stateOfCharge),
      timezone: transactionToSave.timezone,
      signedData: transactionToSave.signedData,
      numberOfMeterValues: Utils.convertToInt(transactionToSave.numberOfMeterValues),
      currentStateOfCharge: Utils.convertToInt(transactionToSave.currentStateOfCharge),
      currentSignedData: transactionToSave.currentSignedData,
      lastConsumption: transactionToSave.lastConsumption,
      currentTotalInactivitySecs: Utils.convertToInt(transactionToSave.currentTotalInactivitySecs),
      currentInactivityStatus: transactionToSave.currentInactivityStatus,
      currentCumulatedPrice: Utils.convertToFloat(transactionToSave.currentCumulatedPrice),
      currentCumulatedRoundedPrice: Utils.convertToFloat(transactionToSave.currentCumulatedRoundedPrice),
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
      migrationTag: transactionToSave.migrationTag,
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
        userID: DatabaseUtils.convertToObjectID(transactionToSave.stop.userID),
        timestamp: Utils.convertToDate(transactionToSave.stop.timestamp),
        tagID: transactionToSave.stop.tagID,
        meterStop: transactionToSave.stop.meterStop,
        reason: transactionToSave.stop.reason,
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
      delete transactionMDB.currentCumulatedRoundedPrice;
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
        userID: DatabaseUtils.convertToObjectID(transactionToSave.remotestop.userID)
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
      transactionMDB.billingData = TransactionStorage.normalizeBillingData(transactionToSave.billingData);
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
    if (transactionToSave.oicpData) {
      transactionMDB.oicpData = {
        session: transactionToSave.oicpData.session,
        cdr: transactionToSave.oicpData.cdr
      };
    }
    // Modify
    await global.database.getCollection<any>(tenant.id, 'transactions').findOneAndReplace(
      { '_id': Utils.convertToInt(transactionToSave.id) },
      transactionMDB,
      { upsert: true });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveTransaction', startTime, transactionMDB);
    return transactionToSave.id;
  }

  public static async saveTransactionOcpiData(tenant: Tenant, id: number,
      ocpiData: TransactionOcpiData): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify document
    await global.database.getCollection<any>(tenant.id, 'transactions').findOneAndUpdate(
      { '_id': id },
      {
        $set: {
          ocpiData
        }
      },
      { upsert: false });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveTransactionOcpiData', startTime, ocpiData);
  }

  public static async updateTransactionsWithOrganizationIDs(tenant: Tenant, companyID: string, siteID: string, siteAreaID?: string): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    let result: UpdateResult;
    if (siteAreaID) {
      result = await global.database.getCollection<any>(tenant.id, 'transactions').updateMany(
        {
          siteAreaID: DatabaseUtils.convertToObjectID(siteAreaID),
        },
        {
          $set: {
            siteID: DatabaseUtils.convertToObjectID(siteID),
            companyID: DatabaseUtils.convertToObjectID(companyID)
          }
        }) as UpdateResult;
    } else {
      result = await global.database.getCollection<any>(tenant.id, 'transactions').updateMany(
        {
          siteID: DatabaseUtils.convertToObjectID(siteID),
        },
        {
          $set: {
            companyID: DatabaseUtils.convertToObjectID(companyID)
          }
        }) as UpdateResult;
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateTransactionsWithOrganizationIDs', startTime, { siteID, companyID, siteAreaID });
    return result.modifiedCount;
  }

  public static async saveTransactionOicpData(tenant: Tenant, id: number,
      oicpData: TransactionOicpData): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify document
    await global.database.getCollection<any>(tenant.id, 'transactions').findOneAndUpdate(
      { '_id': id },
      {
        $set: {
          oicpData
        }
      },
      { upsert: false });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveTransactionOicpData', startTime, oicpData);
  }

  public static async saveTransactionBillingData(tenant: Tenant, id: number,
      billingData: TransactionBillingData): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Normalize billing data
    const billingDataMDB = TransactionStorage.normalizeBillingData(billingData);
    // Modify document
    await global.database.getCollection<any>(tenant.id, 'transactions').findOneAndUpdate(
      { '_id': id },
      {
        $set: {
          billingData: billingDataMDB
        }
      },
      { upsert: false });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveTransactionBillingData', startTime, billingData);
  }

  public static async saveTransactionRefundData(tenant: Tenant, id: number,
      refundData: TransactionRefundData): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify document
    await global.database.getCollection<any>(tenant.id, 'transactions').findOneAndUpdate(
      { '_id': id },
      {
        $set: {
          refundData
        }
      },
      { upsert: false });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveTransactionRefundData', startTime, refundData);
  }

  public static async getTransactionYears(tenant: Tenant): Promise<Date[]> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const firstTransactionsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .find({})
      .sort({ timestamp: 1 })
      .limit(1)
      .toArray() as Transaction[];
    // Found?
    if (Utils.isEmptyArray(firstTransactionsMDB)) {
      return null;
    }
    const transactionYears = [];
    // Push the rest of the years up to now
    for (let i = new Date(firstTransactionsMDB[0].timestamp).getFullYear(); i <= new Date().getFullYear(); i++) {
      transactionYears.push(i);
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTransactionYears', startTime, firstTransactionsMDB);
    return transactionYears;
  }

  public static async getTransactions(tenant: Tenant,
      params: {
        transactionIDs?: number[]; issuer?: boolean; search?: string; ownerID?: string[]; userIDs?: string[]; siteAdminIDs?: string[]; status?: TransactionStatus;
        chargingStationIDs?: string[]; siteAreaIDs?: string[]; siteIDs?: string[]; connectorIDs?: number[]; startDateTime?: Date; withChargingStation?: boolean;
        endDateTime?: Date; stop?: any; minimalPrice?: boolean; reportIDs?: string[]; tagIDs?: string[]; inactivityStatus?: string[];
        ocpiSessionID?: string; ocpiAuthorizationID?: string; ocpiSessionDateFrom?: Date; ocpiSessionDateTo?: Date; ocpiCdrDateFrom?: Date; ocpiCdrDateTo?: Date;
        ocpiSessionChecked?: boolean; ocpiCdrChecked?: boolean; oicpSessionID?: string; withSite?: boolean; withSiteArea?: boolean; withCompany?: boolean;
        statistics?: TransactionStatisticsType; refundStatus?: RefundStatus[]; withTag?: boolean; hasUserID?: boolean; withUser?: boolean; withCar?: boolean;
        transactionsToStop?: boolean; siteOwnerIDs?: string[]; withSmartChargingData?: boolean
      },
      dbParams: DbParams, projectFields?: string[]): Promise<TransactionDataResult> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
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
    if (!Utils.isEmptyArray(params.ownerID)) {
      ownerMatch.$or.push({
        userID: {
          $in: params.ownerID.map((userID) => DatabaseUtils.convertToObjectID(userID))
        }
      });
    }
    if (params.siteAdminIDs) {
      ownerMatch.$or.push({
        siteID: {
          $in: params.siteAdminIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
        }
      });
    }
    if (params.siteOwnerIDs) {
      ownerMatch.$or.push({
        siteID: {
          $in: params.siteOwnerIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
        }
      });
    }
    // Create Aggregation
    const aggregation = [];
    // Filter?
    if (params.search) {
      // Build filter
      filters.$or = [
        { '_id': Utils.convertToInt(params.search) },
        { 'tagID': { $regex: params.search, $options: 'i' } },
        { 'chargeBoxID': { $regex: params.search, $options: 'i' } },
        { 'ocpiData.session.id': params.search },
        { 'ocpiData.session.authorization_id': params.search },
      ];
    }
    // Status
    if (params.status === TransactionStatus.COMPLETED ||
        params.status === TransactionStatus.ACTIVE) {
      filters.stop = {
        $exists: (params.status === TransactionStatus.COMPLETED)
      };
    }
    // OCPI ID
    if (params.ocpiSessionID) {
      filters['ocpiData.session.id'] = params.ocpiSessionID;
    }
    // Authorization ID
    if (params.ocpiAuthorizationID) {
      filters['ocpiData.session.authorization_id'] = params.ocpiAuthorizationID;
    }
    // OICP ID
    if (params.oicpSessionID) {
      filters['oicpData.session.id'] = params.oicpSessionID;
    }
    // Transaction
    if (!Utils.isEmptyArray(params.transactionIDs)) {
      filters._id = {
        $in: params.transactionIDs
      };
    }
    // Issuer
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBoolean(params.issuer)) {
      filters.issuer = params.issuer;
    }
    // User
    if (params.userIDs) {
      filters.userID = { $in: params.userIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID)) };
    }
    // Charge Box
    if (params.chargingStationIDs) {
      filters.chargeBoxID = { $in: params.chargingStationIDs };
    }
    // Tag
    if (params.tagIDs) {
      filters.tagID = { $in: params.tagIDs };
    }
    // Has user ID?
    if (params.hasUserID) {
      filters.$and = [
        { 'userID': { '$exists': true } },
        { 'userID': { '$ne': null } }
      ];
    }
    // Connector
    if (!Utils.isEmptyArray(params.connectorIDs)) {
      filters.connectorId = {
        $in: params.connectorIDs
      };
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
    if (Utils.objectHasProperty(params, 'ocpiSessionChecked')) {
      filters.stop = { $exists: true };
      filters['ocpiData.session'] = { $exists: true, $ne: null };
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
    if (Utils.objectHasProperty(params, 'ocpiCdrChecked')) {
      filters.stop = { $exists: true };
      filters['ocpiData.cdr'] = { $exists: true, $ne: null };
      filters['ocpiData.cdrCheckedOn'] = { $exists: params.ocpiCdrChecked };
    }
    // Check stop transaction
    if (params.stop) {
      filters.stop = filters.stop ? { ...filters.stop, ...params.stop } : params.stop;
    }
    // Inactivity Status
    if (params.inactivityStatus) {
      filters['stop.inactivityStatus'] = { $in: params.inactivityStatus };
    }
    // Site's area ID
    if (params.siteAreaIDs) {
      filters.siteAreaID = {
        $in: params.siteAreaIDs.map((siteAreaID) => DatabaseUtils.convertToObjectID(siteAreaID))
      };
    }
    // Site ID
    if (params.siteIDs) {
      filters.siteID = {
        $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
      };
    }
    // Refund status
    if (!Utils.isEmptyArray(params.refundStatus)) {
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
    // Only opened Transactions
    if (params.transactionsToStop) {
      filters.stop = { $exists: false };
    }
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
    // Only Connector's Transaction ID !== Transaction ID
    if (params.transactionsToStop) {
      TransactionStorage.pushChargingStationInTransactionAggregation(
        tenant, params, projectFields, aggregation);
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Prepare statistics query
    let statsQuery = null;
    switch (params.statistics) {
      case TransactionStatisticsType.HISTORY:
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
      case TransactionStatisticsType.ONGOING:
        statsQuery = {
          $group: {
            _id: null,
            firstTimestamp: { $min: '$timestamp' },
            lastTimestamp: { $max: '$timestamp' },
            totalConsumptionWattHours: { $sum: '$currentTotalConsumptionWh' },
            totalDurationSecs: { $sum: '$currentTotalDurationSecs' },
            totalPrice: { $sum: '$currentCumulatedPrice' },
            totalRoundedPrice: { $sum: '$currentCumulatedRoundedPrice' },
            totalInactivitySecs: { $sum:  '$currentTotalInactivitySecs' },
            currency: { $addToSet: '$priceUnit' },
            count: { $sum: 1 }
          }
        };
        break;
      case TransactionStatisticsType.REFUND:
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
    const transactionsCountMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate<any>([...aggregation, statsQuery], DatabaseUtils.buildAggregateOptions())
      .toArray() as TransactionStats[];
    let transactionCountMDB = (transactionsCountMDB && transactionsCountMDB.length > 0) ? transactionsCountMDB[0] : null;
    // Initialize statistics
    if (!transactionCountMDB) {
      switch (params.statistics) {
        case TransactionStatisticsType.HISTORY:
        case TransactionStatisticsType.ONGOING:
          transactionCountMDB = {
            totalConsumptionWattHours: 0,
            totalDurationSecs: 0,
            totalPrice: 0,
            totalInactivitySecs: 0,
            count: 0
          };
          break;
        case TransactionStatisticsType.REFUND:
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
    if (transactionCountMDB?.countRefundedReports) {
      // Hack!!!
      const countRefundedReports = transactionCountMDB.countRefundedReports as unknown as any[];
      transactionCountMDB.countRefundedReports = countRefundedReports.length;
    }
    // Take first entry as reference currency. Expectation is that we have only one currency for all transaction
    if (transactionCountMDB?.currency) {
      // Hack!!!
      const currency = transactionCountMDB?.currency as unknown as any[];
      transactionCountMDB.currency = currency[0];
    }
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTransactions', startTime, aggregation, transactionCountMDB);
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
    // Add OCPI data
    if (!projectFields || projectFields && projectFields.includes('ocpi')) {
      aggregation.push({
        $addFields: {
          'ocpi': { $gt: ['$ocpiData', null] }
        }
      });
    }
    if (!projectFields || projectFields && projectFields.includes('ocpiWithCdr')) {
      aggregation.push({
        $addFields: {
          'ocpiWithCdr': {
            $cond: { if: { $and: [{ $gt: ['$ocpiData', null] }, { $gt: ['$ocpiData.cdr', null] }] }, then: true, else: false }
          }
        }
      });
    }
    // Charging Station
    if (params.withChargingStation) {
      TransactionStorage.pushChargingStationInTransactionAggregation(
        tenant, params, projectFields, aggregation);
    }
    // Tag
    if (params.withTag) {
      DatabaseUtils.pushTagLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, asField: 'tag', localField: 'tagID',
        foreignField: '_id', oneToOneCardinality: true
      });
      // TODO: [To Investigate] Cause big perf issue in prod (local it takes 2sec with this lookup instead of 165ms, in prod it can takes up to 20s)
      // DatabaseUtils.pushTagLookupInAggregation({
      //   tenantID, aggregation: aggregation, asField: 'stop.tag', localField: 'stop.tagID',
      //   foreignField: '_id', oneToOneCardinality: true
      // });
    }
    // Company
    if (params.withCompany) {
      DatabaseUtils.pushCompanyLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, localField: 'companyID', foreignField: '_id',
        asField: 'company', oneToOneCardinality: true
      });
    }
    // Site
    if (params.withSite) {
      DatabaseUtils.pushSiteLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, localField: 'siteID', foreignField: '_id',
        asField: 'site', oneToOneCardinality: true
      });
    }
    // Site Area
    if (params.withSiteArea || params.transactionsToStop) {
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, localField: 'siteAreaID', foreignField: '_id',
        asField: 'siteArea', oneToOneCardinality: true
      });
    }
    // User
    if (params.withUser) {
      DatabaseUtils.pushUserLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, asField: 'user', localField: 'userID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
      DatabaseUtils.pushUserLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, asField: 'stop.user', localField: 'stop.userID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
    }
    // Car
    if (params.withCar) {
      DatabaseUtils.pushCarLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, asField: 'car', localField: 'carID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
      DatabaseUtils.pushCarCatalogLookupInAggregation({
        tenantID: Constants.DEFAULT_TENANT_ID, aggregation: aggregation, asField: 'carCatalog', localField: 'carCatalogID',
        foreignField: '_id', oneToOneCardinality: true
      });
    }
    // Smart Charging Data
    if (params.withSmartChargingData) {
      DatabaseUtils.pushCarLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, asField: 'car', localField: 'carID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false, projectFields:['converter.amperagePerPhase']
      });
      DatabaseUtils.pushCarCatalogLookupInAggregation({
        tenantID: Constants.DEFAULT_TENANT_ID, aggregation: aggregation, asField: 'carCatalog', localField: 'carCatalogID',
        foreignField: '_id', oneToOneCardinality: true, projectFields:['fastChargePowerMax', 'batteryCapacityFull']
      });
    }
    // Rename ID
    DatabaseUtils.pushRenameDatabaseIDToNumber(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'companyID');
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
    const transactionsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Transaction[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTransactions', startTime, aggregation, transactionsMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(transactionCountMDB),
      stats: transactionCountMDB ? transactionCountMDB : {},
      result: transactionsMDB
    };
  }

  public static async getRefundReports(tenant: Tenant,
      params: { siteIDs?: string[]; userIDs?: string[]; siteAreaIDs?: string[]; },
      dbParams: DbParams, projectFields?: string[]): Promise<{ count: number; result: RefundReport[] }> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    const ownerMatch = { $or: [] };
    const filters: any = { stop: { $exists: true } };
    // Build filters
    filters['refundData.reportId'] = { '$ne': null };
    if (params.userIDs) {
      ownerMatch.$or.push({
        userID: {
          $in: params.userIDs.map((user) => DatabaseUtils.convertToObjectID(user))
        }
      });
    }
    if (params.siteIDs) {
      ownerMatch.$or.push({
        siteID: {
          $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
        }
      });
    }
    if (params.siteAreaIDs) {
      ownerMatch.$or.push({
        siteAreaID: {
          $in: params.siteAreaIDs.map((area) => DatabaseUtils.convertToObjectID(area))
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
    const transactionsCountMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate([...aggregation, statsQuery], DatabaseUtils.buildAggregateOptions())
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
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getRefundReports', startTime, aggregation, reportCountMDB);
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
      tenantID: tenant.id, aggregation: aggregation, asField: 'user', localField: 'userID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Rename ID
    DatabaseUtils.pushRenameDatabaseIDToNumber(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const reportsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as RefundReport[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getRefundReports', startTime, aggregation, reportsMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(reportCountMDB),
      result: reportsMDB
    };
  }

  public static async getTransactionsInError(tenant: Tenant,
      params: {
        search?: string; issuer?: boolean; userIDs?: string[]; chargingStationIDs?: string[];
        siteAreaIDs?: string[]; siteIDs?: string[]; startDateTime?: Date; endDateTime?: Date;
        withChargingStations?: boolean; errorType?: string[]; connectorIDs?: number[];
      }, dbParams: DbParams, projectFields?: string[]): Promise<TransactionInErrorDataResult> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
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
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBoolean(params.issuer)) {
      match.issuer = params.issuer;
    }
    // User / Site Admin
    if (params.userIDs) {
      match.userID = { $in: params.userIDs.map((user) => DatabaseUtils.convertToObjectID(user)) };
    }
    // Charge Box
    if (params.chargingStationIDs) {
      match.chargeBoxID = { $in: params.chargingStationIDs };
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
        $in: params.siteAreaIDs.map((area) => DatabaseUtils.convertToObjectID(area))
      };
    }
    // Sites
    if (params.siteIDs) {
      match.siteID = {
        $in: params.siteIDs.map((site) => DatabaseUtils.convertToObjectID(site))
      };
    }
    // Connectors
    if (!Utils.isEmptyArray(params.connectorIDs)) {
      match.connectorId = {
        $in: params.connectorIDs
      };
    }
    // Create Aggregation
    const aggregation = [];
    aggregation.push({
      $match: match
    });
    // Charging Station
    if (params.withChargingStations ||
      (params.errorType && params.errorType.includes(TransactionInErrorType.OVER_CONSUMPTION))) {
      // Add Charge Box
      DatabaseUtils.pushChargingStationLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, localField: 'chargeBoxID', foreignField: '_id', asField: 'chargeBox',
        oneToOneCardinality: true, oneToOneCardinalityNotNull: false, pipelineMatch: { 'issuer': true }
      });
      DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargeBox.siteAreaID');
    }
    // User
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID: tenant.id, aggregation: aggregation, asField: 'user', localField: 'userID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Car Catalog
    DatabaseUtils.pushCarCatalogLookupInAggregation({
      tenantID: Constants.DEFAULT_TENANT_ID, aggregation: aggregation, asField: 'carCatalog', localField: 'carCatalogID',
      foreignField: '_id', oneToOneCardinality: true
    });
    // Used only in the error type : missing_user
    if (params.errorType && params.errorType.includes(TransactionInErrorType.MISSING_USER)) {
      // Site Area
      DatabaseUtils.pushSiteAreaLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, localField: 'siteAreaID', foreignField: '_id',
        asField: 'siteArea', oneToOneCardinality: true
      });
    }
    // Build facets for each type of error if any
    if (!Utils.isEmptyArray(params.errorType)) {
      const facets: any = { $facet: {} };
      const array = [];
      for (const type of params.errorType) {
        array.push(`$${type}`);
        facets.$facet[type] = TransactionStorage.getTransactionsInErrorFacet(type);
      }
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
      tenantID: tenant.id, aggregation: aggregation, asField: 'stop.user', localField: 'stop.userID',
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
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { _id: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
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
    // Read DB
    const transactionsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as TransactionInError[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTransactionsInError', startTime, aggregation, transactionsMDB);
    return {
      count: transactionsMDB.length,
      result: transactionsMDB
    };
  }

  public static async getTransaction(tenant: Tenant, id: number = Constants.UNKNOWN_NUMBER_ID,
      params: { withTag?: boolean; withCar?: boolean; withUser?: boolean, withChargingStation?: boolean, siteIDs?: string[]; userIDs?: string[] } = {},
      projectFields?: string[]): Promise<Transaction> {
    const transactionsMDB = await TransactionStorage.getTransactions(tenant, {
      transactionIDs: [id],
      withTag: params.withTag,
      withCar: params.withCar,
      withChargingStation: params.withChargingStation,
      withUser: params.withUser,
      userIDs: params.userIDs,
      siteIDs: params.siteIDs,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return transactionsMDB.count === 1 ? transactionsMDB.result[0] : null;
  }

  public static async getOCPITransactionBySessionID(tenant: Tenant, sessionID: string,
      params: { withUser?: boolean } = {}): Promise<Transaction> {
    const transactionsMDB = await TransactionStorage.getTransactions(tenant,
      {
        withUser: params.withUser,
        ocpiSessionID: sessionID
      }, Constants.DB_PARAMS_SINGLE_RECORD);
    return transactionsMDB.count === 1 ? transactionsMDB.result[0] : null;
  }

  public static async getOCPITransactionByAuthorizationID(tenant: Tenant, authorizationID: string): Promise<Transaction> {
    const transactionsMDB = await TransactionStorage.getTransactions(tenant,
      {
        ocpiAuthorizationID: authorizationID
      }, Constants.DB_PARAMS_SINGLE_RECORD);
    return transactionsMDB.count === 1 ? transactionsMDB.result[0] : null;
  }

  public static async getOICPTransactionBySessionID(tenant: Tenant, oicpSessionID: string): Promise<Transaction> {
    const transactionsMDB = await TransactionStorage.getTransactions(tenant,
      {
        oicpSessionID: oicpSessionID
      }, Constants.DB_PARAMS_SINGLE_RECORD);
    return transactionsMDB.count === 1 ? transactionsMDB.result[0] : null;
  }

  public static async getActiveTransaction(tenant: Tenant, chargeBoxID: string, connectorId: number): Promise<Transaction> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
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
      tenantID: tenant.id, aggregation, localField: 'userID', foreignField: '_id', asField: 'user',
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
    const transactionsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Transaction[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getActiveTransaction', startTime, aggregation, transactionsMDB);
    return transactionsMDB.length === 1 ? transactionsMDB[0] : null;
  }

  public static async getLastTransactionFromChargingStation(tenant: Tenant, chargeBoxID: string, connectorId: number,
      params: { withChargingStation?: boolean; withUser?: boolean; withTag?: boolean; } = {}): Promise<Transaction> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
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
        tenantID: tenant.id, aggregation: aggregation, localField: 'chargeBoxID', foreignField: '_id',
        asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
    }
    // Add User
    if (params.withUser) {
      DatabaseUtils.pushUserLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, localField: 'userID', foreignField: '_id',
        asField: 'user', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
    }
    // Tag
    if (params.withTag) {
      DatabaseUtils.pushTagLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, asField: 'tag', localField: 'tagID',
        foreignField: '_id', oneToOneCardinality: true
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
    const transactionsMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Transaction[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getLastTransactionFromChargingStation', startTime, aggregation, transactionsMDB);
    return transactionsMDB.length === 1 ? transactionsMDB[0] : null;
  }

  public static async findAvailableID(tenant: Tenant): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    let existingTransaction: Transaction;
    do {
      // Generate new transaction ID
      const id = Utils.getRandomIntSafe();
      existingTransaction = await TransactionStorage.getTransaction(tenant, id);
      if (existingTransaction) {
        await Logging.logWarning({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'findAvailableID',
          action: ServerAction.TRANSACTION_STARTED,
          message: `Transaction ID '${id}' already exists, generating a new one...`
        });
      } else {
        return id;
      }
    } while (existingTransaction);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'findAvailableID', startTime, {});
  }

  public static async getNotStartedTransactions(tenant: Tenant,
      params: { checkPastAuthorizeMins: number; sessionShouldBeStartedAfterMins: number }): Promise<DataResult<NotifySessionNotStarted>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Compute the date some minutes ago
    const authorizeStartDate = moment().subtract(params.checkPastAuthorizeMins, 'minutes').toDate();
    const authorizeEndDate = moment().subtract(params.sessionShouldBeStartedAfterMins, 'minutes').toDate();
    // Create Aggregation
    const aggregation = [];
    // Authorization window
    aggregation.push({
      $match: {
        issuer: true,
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
        from: DatabaseUtils.getCollectionName(tenant.id, 'transactions'),
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
      tenantID: tenant.id, aggregation, localField: 'userID', foreignField: '_id',
      asField: 'user', oneToOneCardinality: true, oneToOneCardinalityNotNull: true
    });
    // Lookup for charging station
    DatabaseUtils.pushChargingStationLookupInAggregation({
      tenantID: tenant.id, aggregation, localField: 'chargeBoxID', foreignField: '_id',
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
    const notifySessionNotStartedMDB = await global.database.getCollection<any>(tenant.id, 'authorizes')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as NotifySessionNotStarted[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getNotStartedTransactions', startTime, aggregation, notifySessionNotStartedMDB);
    return {
      count: notifySessionNotStartedMDB.length,
      result: notifySessionNotStartedMDB
    };
  }

  public static async getCollectedFunds(tenant: Tenant): Promise<{ count: number; result: CollectedFundReport[] }> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Create Aggregation
    const aggregation = [];
    // Authorization window
    aggregation.push({
      $match: {
        $and: [
          { 'billingData.withBillingActive': { $eq: true } },
          { 'billingData.stop.status': { $eq: BillingStatus.BILLED } },
          { 'billingData.stop.invoiceItem.accountData.accountID': { $exists: true } },
          { 'billingData.stop.transferID': { $exists: false } },
        ]
      }
    });
    // Group by accountID
    aggregation.push({
      $group: {
        '_id': { accountID: '$billingData.stop.invoiceItem.accountData.accountID', currency: '$stop.priceUnit' },
        collectedFunds: { $sum: '$stop.roundedPrice' },
        collectedFlatFees: { $sum: '$billingData.stop.invoiceItem.accountData.platformFeeStrategy.flatFeePerSession' },
        collectedFees: { $sum: '$billingData.stop.invoiceItem.accountData.feeAmount' },
        totalConsumptionWh: { $sum: '$stop.totalConsumptionWh' },
        totalDurationSecs: { $sum: '$stop.totalDurationSecs' },
        transactionIDs: { $push: '$_id' },
      },
    });
    // Format Data
    aggregation.push({
      $project: {
        _id: 1,
        key: '$_id',
        collectedFunds: 1,
        collectedFlatFees: 1,
        collectedFees: 1,
        totalConsumptionWh: 1,
        totalDurationSecs: 1,
        transactionIDs: 1
      }
    });
    // Read DB
    const resultMDB = await global.database.getCollection<any>(tenant.id, 'transactions')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as CollectedFundReport[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getCollectedFunds', startTime, aggregation, resultMDB);
    return {
      count: resultMDB.length,
      result: resultMDB
    };
  }

  public static async updateTransactionsWithTransferData(tenant: Tenant, transactionsIDs: number[], transferID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // At least one ChargingStation
    if (!Utils.isEmptyArray(transactionsIDs)) {
      // Update all transactions
      await global.database.getCollection<any>(tenant.id, 'transactions').updateMany(
        { '_id': { $in: transactionsIDs } },
        {
          $set: {
            'billingData.stop.transferID' : DatabaseUtils.convertToObjectID(transferID)
          }
        });
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateTransactionsWithTransferData', startTime, transactionsIDs);
  }

  private static normalizeBillingData(billingData: TransactionBillingData): any {
    if (billingData) {
      const normalizedData = {
        withBillingActive: billingData.withBillingActive,
        lastUpdate: Utils.convertToDate(billingData.lastUpdate),
        stop: {
          status: billingData.stop?.status,
          invoiceID: DatabaseUtils.convertToObjectID(billingData.stop?.invoiceID),
          invoiceNumber: billingData.stop?.invoiceNumber,
          invoiceStatus: billingData.stop?.invoiceStatus,
          invoiceItem: billingData.stop?.invoiceItem,
          transferID: DatabaseUtils.convertToObjectID(billingData.stop?.transferID),
        },
      };
      if (!billingData.stop?.transferID) {
        // This is very important!
        delete normalizedData.stop.transferID;
      }
      return normalizedData;
    }
    return null;
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
          { $match: { 'stop.totalConsumptionWh': { $eq: 0 } } },
          { $addFields: { 'errorCode': TransactionInErrorType.NO_CONSUMPTION } }
        ];
      case TransactionInErrorType.LOW_CONSUMPTION:
        return [
          { $match: { 'stop.totalConsumptionWh': { $gt: 0, $lt: Constants.AFIREV_MINIMAL_CONSUMPTION_THRESHOLD } } },
          { $addFields: { 'errorCode': TransactionInErrorType.LOW_CONSUMPTION } }
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
      case TransactionInErrorType.LOW_DURATION:
        return [
          { $match: { 'stop.totalDurationSecs': { $gte: 0, $lt: Constants.AFIREV_MINIMAL_DURATION_THRESHOLD } } },
          { $addFields: { 'errorCode': TransactionInErrorType.LOW_DURATION } }
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
              'userID': null,
            }
          },
          { $addFields: { 'errorCode': TransactionInErrorType.MISSING_USER } }
        ];
      case TransactionInErrorType.NO_BILLING_DATA:
        return [
          {
            $match: {
              $and: [
                { 'billingData.withBillingActive': { $eq: true } },
                {
                  $or: [
                    { 'billingData': { $exists: false } },
                    { 'billingData.stop': { $exists: false } },
                    { 'billingData.stop.status': { $eq: BillingStatus.FAILED } },
                  ]
                }
              ]
            }
          },
          { $addFields: { 'errorCode': TransactionInErrorType.NO_BILLING_DATA } }
        ];
      default:
        return [];
    }
  }

  private static pushChargingStationInTransactionAggregation(tenant: Tenant,
      params: { withChargingStation?: boolean, transactionsToStop?: boolean },
      projectFields: string[], aggregation: any[]) {
    // Add Charging Station
    DatabaseUtils.pushChargingStationLookupInAggregation({
      tenantID: tenant.id, aggregation: aggregation, localField: 'chargeBoxID', foreignField: '_id',
      asField: 'chargeBox', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'chargeBox.siteAreaID');
    // Do we need the connector status
    const withStatus = !!projectFields?.includes('status');
    // Add Connector and Status
    if (withStatus || params.transactionsToStop) {
      aggregation.push({
        $addFields: {
          connector: {
            '$arrayElemAt': [
              {
                '$filter': {
                  input: '$chargeBox.connectors',
                  as: 'connector',
                  cond: {
                    $eq: [
                      '$$connector.connectorId',
                      '$connectorId'
                    ]
                  }
                }
              },
              0
            ]
          }
        }
      });
      if (withStatus) {
        // ok - let's add the connector status
        aggregation.push({
          $addFields: { status: '$connector.status' }
        });
      }
      if (params.transactionsToStop) {
        aggregation.push(
          {
            // Make sure we have connectors (to avoid conflicts with a OcppBootNotification where connectors temporarily are cleared)
            '$match': { 'connector': { $exists: true, $ne: null } }
          },
          {
            // let's check whether the current transaction matches the one referenced by the connector
            '$addFields': {
              'transactionIsStillInProgress': { '$eq': ['$connector.currentTransactionID', '$_id'] }
            }
          },
          {
            // Select only the transactions which are not in progress anymore
            '$match': { 'transactionIsStillInProgress': false }
          }
        );
      }
    }
    params.withChargingStation = false;
  }
}
