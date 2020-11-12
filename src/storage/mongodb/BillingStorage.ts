import { BillingInvoice, BillingInvoiceDocument, BillingInvoiceStatus } from '../../types/Billing';
import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'BillingStorage';

export default class BillingStorage {
  public static async getInvoice(tenantID: string, id: string = Constants.UNKNOWN_OBJECT_ID): Promise<BillingInvoice> {
    const invoicesMDB = await BillingStorage.getInvoices(tenantID, {
      invoiceIDs: [id]
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return invoicesMDB.count === 1 ? invoicesMDB.result[0] : null;
  }

  public static async getInvoiceByBillingInvoiceID(tenantID: string, id: string): Promise<BillingInvoice> {
    const invoicesMDB = await BillingStorage.getInvoices(tenantID, {
      billingInvoiceID: id
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return invoicesMDB.count === 1 ? invoicesMDB.result[0] : null;
  }

  public static async getInvoices(tenantID: string,
    params: {
      invoiceIDs?: string[]; billingInvoiceID?: string; search?: string; userIDs?: string[]; invoiceStatus?: BillingInvoiceStatus[];
      startDateTime?: Date; endDateTime?: Date;
    } = {},
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<BillingInvoice>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getInvoices');
    // Check Tenant
    await Utils.checkTenant(tenantID);
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
        { 'number': { $regex: Utils.escapeSpecialCharsInRegex(params.search), $options: 'i' } }
      ];
    }
    if (!Utils.isEmptyArray(params.invoiceIDs)) {
      filters._id = {
        $in: params.invoiceIDs.map((invoiceID) => Utils.convertToObjectID(invoiceID))
      };
    }
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.userID = {
        $in: params.userIDs.map((userID) => Utils.convertToObjectID(userID))
      };
    }
    if (params.billingInvoiceID) {
      filters.invoiceID = { $eq: params.billingInvoiceID };
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
    const invoicesCountMDB = await global.database.getCollection<any>(tenantID, 'invoices')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      Logging.traceEnd(tenantID, MODULE_NAME, 'getInvoices', uniqueTimerID, invoicesCountMDB);
      return {
        count: (invoicesCountMDB.length > 0 ? invoicesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { name: 1 };
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
      tenantID, aggregation: aggregation, asField: 'user', localField: 'userID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const invoicesMDB = await global.database.getCollection<BillingInvoice>(tenantID, 'invoices')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getInvoices', uniqueTimerID, invoicesMDB);
    return {
      count: (invoicesCountMDB.length > 0 ?
        (invoicesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : invoicesCountMDB[0].count) : 0),
      result: invoicesMDB
    };
  }

  public static async saveInvoice(tenantID: string, invoiceToSave: Partial<BillingInvoice>): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveInvoice');
    // Build Request
    // Properties to save
    const invoiceMDB = {
      _id: invoiceToSave.id ? Utils.convertToObjectID(invoiceToSave.id) : new ObjectID(),
      invoiceID: invoiceToSave.invoiceID,
      number: invoiceToSave.number,
      userID: invoiceToSave.user ? Utils.convertToObjectID(invoiceToSave.user.id) : null,
      customerID: invoiceToSave.customerID,
      amount: Utils.convertToFloat(invoiceToSave.amount),
      status: invoiceToSave.status,
      currency: invoiceToSave.currency,
      createdOn: Utils.convertToDate(invoiceToSave.createdOn),
      nbrOfItems: Utils.convertToInt(invoiceToSave.nbrOfItems),
      downloadable: Utils.convertToBoolean(invoiceToSave.downloadable),
      downloadUrl: invoiceToSave.downloadUrl
    };
    // Modify and return the modified document
    await global.database.getCollection<BillingInvoice>(tenantID, 'invoices').findOneAndReplace(
      { _id: invoiceMDB._id },
      invoiceMDB,
      { upsert: true }
    );
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveInvoice', uniqueTimerID, invoiceMDB);
    return invoiceMDB._id.toHexString();
  }

  public static async saveInvoiceDocument(tenantID: string, invoiceDocumentToSave: BillingInvoiceDocument): Promise<BillingInvoiceDocument> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveInvoiceDocument');
    // Build Request
    // Properties to save
    const invoiceDocumentMDB: any = {
      _id: Utils.convertToObjectID(invoiceDocumentToSave.id),
      type: invoiceDocumentToSave.type,
      invoiceID: invoiceDocumentToSave.invoiceID,
      encoding: invoiceDocumentToSave.encoding,
      content: invoiceDocumentToSave.content
    };
    // Modify and return the modified document
    await global.database.getCollection<BillingInvoiceDocument>(tenantID, 'invoicedocuments').findOneAndReplace(
      { _id: invoiceDocumentMDB._id },
      invoiceDocumentMDB,
      { upsert: true }
    );
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveInvoiceDocument', uniqueTimerID, invoiceDocumentMDB);
    return invoiceDocumentMDB._id.toHexString();
  }

  public static async getInvoiceDocument(tenantID: string, id: string): Promise<BillingInvoiceDocument> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getInvoiceDocument');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const invoiceDocumentMDB = await global.database.getCollection<BillingInvoiceDocument>(tenantID, 'invoicedocuments')
      .findOne({ _id: Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getInvoiceDocument', uniqueTimerID, invoiceDocumentMDB);
    return invoiceDocumentMDB;
  }

  public static async deleteInvoice(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteInvoice');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete the Invoice
    await global.database.getCollection<BillingInvoice>(tenantID, 'invoices')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Delete the Invoice Document
    await global.database.getCollection<BillingInvoice>(tenantID, 'invoicedocuments')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteInvoice', uniqueTimerID, { id });
  }

  public static async deleteInvoiceByInvoiceID(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteInvoice');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete the Invoice
    await global.database.getCollection<BillingInvoice>(tenantID, 'invoices')
      .findOneAndDelete({ 'invoiceID': id });
    // Delete the Invoice Document
    await global.database.getCollection<BillingInvoice>(tenantID, 'invoicedocuments')
      .findOneAndDelete({ 'invoiceID': id });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteInvoice', uniqueTimerID, { id });
  }
}
