import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import { BillingInvoice, BillingInvoiceStatus } from '../../types/Billing';
import DbParams from '../../types/database/DbParams';
import { DataResult } from '../../types/DataResult';
import global from '../../types/GlobalType';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';
import UserStorage from './UserStorage';

const MODULE_NAME = 'BillingStorage';

export default class BillingStorage {
  public static async getInvoice(tenantID: string, id: string): Promise<BillingInvoice> {
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

  public static async getInvoices(tenantID: string,
    params: {
      invoiceID?: string; search?: string; userID?: string; invoiceStatus?: BillingInvoiceStatus[];
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
    const filters: ({ _id?: ObjectID; $or?: any[] } | undefined) = {};
    if (params.invoiceID) {
      filters._id = Utils.convertToObjectID(params.invoiceID);
    } else if (params.search) {
      filters.$or = [
        { 'number': { $regex: Utils.escapeSpecialCharsInRegex(params.search), $options: 'i' } }
      ];
    }
    // Create Aggregation
    const aggregation = [];
    // Set filters

    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    if (params.userID) {
      aggregation.push({
        $match: {
          'userID': { $eq: Utils.convertToObjectID(params.userID) }
        }
      });
    }
    // Status (Previously getUsersInError)
    if (params.invoiceStatus && Array.isArray(params.invoiceStatus) && params.invoiceStatus.length > 0) {
      aggregation.push({
        $match: {
          'status': { $in: params.invoiceStatus }
        }
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
    if (!user) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'saveInvoice',
        message: 'User does not exists'
      });
    }
    // Build Request
    // Properties to save
    const invoiceMDB: any = {
      _id: invoiceToSave.id ? Utils.convertToObjectID(invoiceToSave.id) : new ObjectID(),
      invoiceID: invoiceToSave.invoiceID,
      number: invoiceToSave.number,
      userID: Utils.convertToObjectID(user.id),
      customerID: invoiceToSave.customerID,
      amount: Utils.convertToFloat(invoiceToSave.amount),
      status: invoiceToSave.status,
      currency: invoiceToSave.currency,
      createdOn: Utils.convertToDate(invoiceToSave.createdOn),
      nbrOfItems: Utils.convertToInt(invoiceToSave.nbrOfItems)
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
}
