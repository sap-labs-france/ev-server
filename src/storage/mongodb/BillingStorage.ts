import { BillingInvoice, BillingInvoicePdf, BillingInvoiceStatus } from '../../types/Billing';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import UserStorage from './UserStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'BillingStorage';

export default class BillingStorage {
  public static async getInvoice(tenantID: string, id: string = Constants.UNKNOWN_OBJECT_ID): Promise<BillingInvoice> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getInvoice');
    // Query single Site
    const invoicesMDB = await BillingStorage.getInvoices(tenantID,
      { invoiceID: id },
      Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getInvoice', uniqueTimerID, { id });
    return invoicesMDB.count > 0 ? invoicesMDB.result[0] : null;
  }

  public static async getInvoiceByBillingInvoiceID(tenantID: string, billingInvoiceID: string): Promise<BillingInvoice> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getInvoice');
    // Query single Site
    const invoicesMDB = await BillingStorage.getInvoices(tenantID,
      { billingInvoiceID: billingInvoiceID },
      Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getInvoice', uniqueTimerID, { billingInvoiceID });
    return invoicesMDB.count > 0 ? invoicesMDB.result[0] : null;
  }

  public static async getInvoices(tenantID: string,
    params: {
      invoiceID?: string; billingInvoiceID?: string; search?: string; userIDs?: string[]; invoiceStatus?: BillingInvoiceStatus[];
      startDateTime?: Date; endDateTime?: Date;
    } = {},
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<BillingInvoice>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getInvoices');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);
    // Search filters
    const filters: any = {};
    // Filter by ID
    if (params.invoiceID) {
      filters._id = Utils.convertToObjectID(params.invoiceID);
      // Filter by other properties
    } else if (params.search) {
      filters.$or = [
        { 'number': { $regex: Utils.escapeSpecialCharsInRegex(params.search), $options: 'i' } }
      ];
    }
    // Create Aggregation
    const aggregation = [];
    if (params.userIDs) {
      filters.userID = { $in: params.userIDs.map((userID) => Utils.convertToObjectID(userID)) };
    }
    if (params.billingInvoiceID) {
      filters.invoiceID = { $eq: params.billingInvoiceID };
    }
    // Status
    if (params.invoiceStatus && Array.isArray(params.invoiceStatus) && params.invoiceStatus.length > 0) {
      filters.status = { $in: params.invoiceStatus };
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
      return {
        count: (invoicesCountMDB.length > 0 ? invoicesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (dbParams.sort) {
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      aggregation.push({
        $sort: { name: 1 }
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
    Logging.traceEnd(MODULE_NAME, 'getInvoices', uniqueTimerID, { params });
    return {
      count: (invoicesCountMDB.length > 0 ?
        (invoicesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : invoicesCountMDB[0].count) : 0),
      result: invoicesMDB
    };
  }

  public static async saveInvoice(tenantId: string, invoiceToSave: Partial<BillingInvoice>): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveInvoice');
    const user = await UserStorage.getUserByBillingID(tenantId, invoiceToSave.customerID);
    // Build Request
    // Properties to save
    const invoiceMDB: any = {
      _id: invoiceToSave.id ? Utils.convertToObjectID(invoiceToSave.id) : new ObjectID(),
      invoiceID: invoiceToSave.invoiceID,
      number: invoiceToSave.number,
      userID: user ? Utils.convertToObjectID(user.id) : null,
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
    await global.database.getCollection<BillingInvoice>(tenantId, 'invoices').findOneAndReplace(
      { _id: invoiceMDB._id },
      invoiceMDB,
      { upsert: true }
    );
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveInvoice', uniqueTimerID, { invoiceMDB });
    return invoiceMDB._id.toHexString();
  }

  public static async saveInvoicePdf(tenantId: string, invoicePdf: BillingInvoicePdf): Promise<BillingInvoicePdf> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveInvoicePdf');
    // Build Request
    // Properties to save
    const invoiceFileMDB: any = {
      _id: invoicePdf.id ? Utils.convertToObjectID(invoicePdf.id) : new ObjectID(),
      encodedPdf: invoicePdf.encodedPdf
    };
    // Modify and return the modified document
    await global.database.getCollection<BillingInvoicePdf>(tenantId, 'invoicespdf').findOneAndReplace(
      { _id: invoiceFileMDB._id },
      invoiceFileMDB,
      { upsert: true }
    );
    // Debug
    Logging.traceEnd(MODULE_NAME, 'saveInvoicePdf', uniqueTimerID, { invoiceFileMDB });
    return invoiceFileMDB._id.toHexString();
  }

  public static async getInvoicePdf(tenantID: string, id: string): Promise<BillingInvoicePdf> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getInvoicePdf');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Read DB
    const invoicePdfMDB: { _id: string; encodedPdf: string } = await global.database.getCollection(tenantID, 'invoicespdf')
      .findOne({ _id: Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getInvoicePdf', uniqueTimerID, { id });
    return {
      id: id, encodedPdf: (invoicePdfMDB ? invoicePdfMDB.encodedPdf : null)
    };
  }

  public static async deleteInvoice(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'deleteInvoice');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete the Company
    await global.database.getCollection<BillingInvoice>(tenantID, 'invoices')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'deleteInvoice', uniqueTimerID, { id });
  }

  public static async deleteInvoiceByInvoiceID(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'deleteInvoice');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Delete the Company
    await global.database.getCollection<BillingInvoice>(tenantID, 'invoices')
      .findOneAndDelete({ 'invoiceID': id });
    // Debug
    Logging.traceEnd(MODULE_NAME, 'deleteInvoice', uniqueTimerID, { id });
  }
}
