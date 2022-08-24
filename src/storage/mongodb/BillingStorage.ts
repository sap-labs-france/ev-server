import { BillingAccount, BillingInvoice, BillingInvoiceStatus, BillingTransfer } from '../../types/Billing';
import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'BillingStorage';

export default class BillingStorage {
  public static async getInvoice(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID, params: { userIDs?: string[] } = {}, projectFields?: string[]): Promise<BillingInvoice> {
    const invoicesMDB = await BillingStorage.getInvoices(tenant, {
      invoiceIDs: [id], userIDs: params.userIDs
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return invoicesMDB.count === 1 ? invoicesMDB.result[0] : null;
  }

  public static async getInvoiceByInvoiceID(tenant: Tenant, id: string): Promise<BillingInvoice> {
    const invoicesMDB = await BillingStorage.getInvoices(tenant, {
      billingInvoiceID: id
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return invoicesMDB.count === 1 ? invoicesMDB.result[0] : null;
  }

  public static async getInvoices(tenant: Tenant,
      params: {
        invoiceIDs?: string[]; billingInvoiceID?: string; search?: string; userIDs?: string[]; invoiceStatus?: BillingInvoiceStatus[];
        startDateTime?: Date; endDateTime?: Date; liveMode?: boolean
      } = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<BillingInvoice>> {
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
    // Search filters
    const filters: FilterParams = {};
    // Search
    // Filter by other properties
    if (params.search) {
      filters.$or = [
        { 'number': { $regex: params.search, $options: 'i' } }
      ];
    }
    if (!Utils.isEmptyArray(params.invoiceIDs)) {
      filters._id = {
        $in: params.invoiceIDs.map((invoiceID) => DatabaseUtils.convertToObjectID(invoiceID))
      };
    }
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.userID = {
        $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID))
      };
    }
    if (params.billingInvoiceID) {
      filters.invoiceID = { $eq: params.billingInvoiceID };
    }
    // liveMode (to clear test data)
    if (params.liveMode) {
      filters.liveMode = { $eq: params.liveMode };
    }
    // Status
    if (!Utils.isEmptyArray(params.invoiceStatus)) {
      filters.status = {
        $in: params.invoiceStatus
      };
    }
    if (params.startDateTime || params.endDateTime) {
      filters.createdOn = {};
    }
    // Start date
    if (params.startDateTime) {
      filters.createdOn.$gte = Utils.convertToDate(params.startDateTime);
    }
    // End date
    if (params.endDateTime) {
      filters.createdOn.$lte = Utils.convertToDate(params.endDateTime);
    }
    // Set filters
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const invoicesCountMDB = await global.database.getCollection<any>(tenant.id, 'invoices')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getInvoices', startTime, aggregation, invoicesCountMDB);
      return {
        count: (invoicesCountMDB.length > 0 ? invoicesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
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
    // Add Users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID: tenant.id, aggregation: aggregation, asField: 'user', localField: 'userID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const invoicesMDB = await global.database.getCollection<any>(tenant.id, 'invoices')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as BillingInvoice[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getInvoices', startTime, aggregation, invoicesMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(invoicesCountMDB[0]),
      result: invoicesMDB
    };
  }

  public static async saveInvoice(tenant: Tenant, invoiceToSave: BillingInvoice): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Build Request
    // Properties to save
    const invoiceMDB: any = {
      _id: invoiceToSave.id ? DatabaseUtils.convertToObjectID(invoiceToSave.id) : new ObjectId(),
      invoiceID: invoiceToSave.invoiceID,
      // eslint-disable-next-line id-blacklist
      number: invoiceToSave.number,
      liveMode: Utils.convertToBoolean(invoiceToSave.liveMode),
      userID: invoiceToSave.userID ? DatabaseUtils.convertToObjectID(invoiceToSave.userID) : null,
      customerID: invoiceToSave.customerID,
      amount: Utils.convertToFloat(invoiceToSave.amount),
      amountPaid: Utils.convertToFloat(invoiceToSave.amountPaid),
      status: invoiceToSave.status,
      currency: invoiceToSave.currency,
      createdOn: Utils.convertToDate(invoiceToSave.createdOn),
      downloadable: Utils.convertToBoolean(invoiceToSave.downloadable),
      downloadUrl: invoiceToSave.downloadUrl,
      payInvoiceUrl: invoiceToSave.payInvoiceUrl
    };
    if (invoiceToSave.sessions) {
      invoiceMDB.sessions = invoiceToSave.sessions;
    }
    if (invoiceToSave.lastError) {
      invoiceMDB.lastError = invoiceToSave.lastError;
    }
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'invoices').findOneAndUpdate(
      { _id: invoiceMDB._id },
      { $set: invoiceMDB },
      { upsert: true, returnDocument: 'after' }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveInvoice', startTime, invoiceMDB);
    return invoiceMDB._id.toString();
  }

  public static async deleteInvoice(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete the Invoice
    await global.database.getCollection<any>(tenant.id, 'invoices')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteInvoice', startTime, { id });
  }

  public static async deleteInvoiceByInvoiceID(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete the Invoice
    await global.database.getCollection<any>(tenant.id, 'invoices')
      .findOneAndDelete({ 'invoiceID': id });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteInvoiceByInvoiceID', startTime, { id });
  }

  public static async saveAccount(tenant: Tenant, billingAccount: BillingAccount): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Build Request
    // Properties to save
    const billingAccountMDB: any = {
      _id: billingAccount.id ? DatabaseUtils.convertToObjectID(billingAccount.id) : new ObjectId(),
      status: billingAccount.status,
      businessOwnerID: DatabaseUtils.convertToObjectID(billingAccount.businessOwnerID),
      accountExternalID: billingAccount.accountExternalID,
      activationLink: billingAccount.activationLink, // Should not be persisted - added here only for troubleshooting purposes
      companyName: billingAccount.companyName
    };
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(billingAccountMDB, billingAccount);
    // Save
    await global.database.getCollection<any>(tenant.id, 'billingaccounts').findOneAndUpdate(
      { _id: billingAccountMDB._id },
      { $set: billingAccountMDB },
      { upsert: true, returnDocument: 'after' }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveAccount', startTime, billingAccountMDB);
    return billingAccountMDB._id.toString();
  }

  public static async getAccounts(tenant: Tenant,
      params: {
        IDs?: string[], accountExternalIDs?: string[], search?: string, userIDs?: string[], status?: string[]
      } = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<BillingAccount>> {
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
    // Search filters
    const filters: FilterParams = {};
    // Search
    // Filter by other properties
    if (params.search) {
      filters.$or = [
        { 'accountExternalID': { $regex: params.search, $options: 'i' } }
      ];
    }
    if (!Utils.isEmptyArray(params.IDs)) {
      filters._id = {
        $in: params.IDs.map((id) => DatabaseUtils.convertToObjectID(id))
      };
    }
    if (!Utils.isEmptyArray(params.accountExternalIDs)) {
      filters.accountExternalID = {
        $in: params.accountExternalIDs
      };
    }
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.businessOwnerID = {
        $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID))
      };
    }
    // Status
    if (!Utils.isEmptyArray(params.status)) {
      filters.status = {
        $in: params.status
      };
    }
    // Set filters
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const billingAccountCountMDB = await global.database.getCollection<any>(tenant.id, 'billingaccounts')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getAccounts', startTime, aggregation, billingAccountCountMDB);
      return {
        count: (billingAccountCountMDB.length > 0 ? billingAccountCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID: tenant.id, aggregation: aggregation, asField: 'businessOwner', localField: 'businessOwnerID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
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
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'businessOwnerID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const billingAccountMDB = await global.database.getCollection<any>(tenant.id, 'billingaccounts')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as BillingAccount[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getAccounts', startTime, aggregation, billingAccountMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(billingAccountCountMDB[0]),
      result: billingAccountMDB
    };
  }

  public static async getAccountByID(tenant: Tenant, id: string, projectFields?: string[]): Promise<BillingAccount> {
    const billingAccountMDB = await BillingStorage.getAccounts(tenant, {
      IDs: [id]
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return billingAccountMDB.count === 1 ? billingAccountMDB.result[0] : null;
  }

  public static async saveTransfer(tenant: Tenant, transfer: BillingTransfer): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Build Request
    // Properties to save
    const transferMDB: any = {
      _id: transfer.id ? DatabaseUtils.convertToObjectID(transfer.id) : new ObjectId(),
      status: transfer.status,
      sessionCounter: transfer.sessionCounter,
      collectedFunds: transfer.collectedFunds,
      collectedFlatFees: transfer.collectedFlatFees,
      collectedFees: transfer.collectedFees,
      totalConsumptionWh: transfer.totalConsumptionWh,
      totalDurationSecs: transfer.totalDurationSecs,
      transferAmount: transfer.transferAmount,
      accountID: DatabaseUtils.convertToObjectID(transfer.accountID),
      transferExternalID: transfer.transferExternalID,
      currency: transfer.currency,
    };
    if (transfer.platformFeeData) {
      transferMDB.platformFeeData = {
        // TODO - TO BE CLARIFIED - REDUNDANT INFORMATION
        feeAmount: transfer.platformFeeData.feeAmount,
        feeTaxAmount: transfer.platformFeeData.feeTaxAmount,
      };
    }
    if (transfer.invoice) {
      transferMDB.invoice = {
        invoiceID: transfer.invoice.invoiceID,
        liveMode: transfer.invoice.liveMode,
        userID: transfer.invoice.userID,
        documentNumber: transfer.invoice.documentNumber,
        status: transfer.invoice.status,
        amount: transfer.invoice.amount,
        totalAmount: transfer.invoice.totalAmount,
        currency: transfer.invoice.currency,
        customerID: transfer.invoice.customerID,
        createdOn: transfer.invoice.createdOn,
      };
    }
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(transferMDB, transfer);
    // Save
    await global.database.getCollection<any>(tenant.id, 'billingtransfers').findOneAndUpdate(
      { _id: transferMDB._id },
      { $set: transferMDB },
      { upsert: true, returnDocument: 'after' }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveTransfer', startTime, transferMDB);
    return transferMDB._id.toString();
  }

  public static async getTransfers(tenant: Tenant,
      params: {
        IDs?: string[], status?: string[], accountIDs?: string[], search?: string, transferExternalIDs?: string[]
      } = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<BillingTransfer>> {
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
    // Search filters
    const filters: FilterParams = {};
    // Search
    // Filter by other properties
    if (params.search) {
      filters.$or = [
        { 'id': { $regex: params.search, $options: 'i' } },
        { 'accountID': { $regex: params.search, $options: 'i' } },
        { 'transferExternalID': { $regex: params.search, $options: 'i' } },
      ];
    }
    if (!Utils.isEmptyArray(params.IDs)) {
      filters._id = {
        $in: params.IDs.map((id) => DatabaseUtils.convertToObjectID(id))
      };
    }
    if (!Utils.isEmptyArray(params.status)) {
      filters.status = {
        $in: params.status
      };
    }
    if (!Utils.isEmptyArray(params.accountIDs)) {
      filters.accountID = {
        $in: params.accountIDs.map((accountID) => DatabaseUtils.convertToObjectID(accountID))
      };
    }
    if (!Utils.isEmptyArray(params.transferExternalIDs)) {
      filters.transferExternalID = {
        $in: params.transferExternalIDs.map((transferExternalID) => DatabaseUtils.convertToObjectID(transferExternalID))
      };
    }
    // Set filters
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const transferCountMDB = await global.database.getCollection<any>(tenant.id, 'billingtransfers')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTransfers', startTime, aggregation, transferCountMDB);
      return {
        count: (transferCountMDB.length > 0 ? transferCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
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
    // Add connected account information
    DatabaseUtils.pushAccountLookupInAggregation({
      tenantID: tenant.id, aggregation: aggregation, asField: 'account', localField: 'accountID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Add Business Owner
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID: tenant.id, aggregation: aggregation, asField: 'businessOwner', localField: 'account.businessOwnerID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Convert
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'account.businessOwnerID');
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'accountID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'accountID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const transferMDB = await global.database.getCollection<any>(tenant.id, 'billingtransfers')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as BillingTransfer[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTransfers', startTime, aggregation, transferMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(transferCountMDB[0]),
      result: transferMDB
    };
  }

  public static async getTransfer(tenant: Tenant, id: string, projectFields?: string[]): Promise<BillingTransfer> {
    const transferMDB = await BillingStorage.getTransfers(tenant, {
      IDs: [id]
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return transferMDB.count === 1 ? transferMDB.result[0] : null;
  }
}
