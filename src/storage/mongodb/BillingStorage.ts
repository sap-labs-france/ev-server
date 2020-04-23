import { ObjectID } from 'mongodb';
import DbParams from '../../types/database/DbParams';
import { DataResult } from '../../types/DataResult';
import global from '../../types/GlobalType';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import DatabaseUtils from './DatabaseUtils';
import { BillingInvoice, BillingInvoiceStatus } from '../../types/Billing';
import UserStorage from './UserStorage';
import BackendError from '../../exception/BackendError';

const MODULE_NAME = 'BillingStorage';

export default class BillingStorage {
  public static async getInvoice(tenantID: string, id: string): Promise<BillingInvoice> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'getInvoice');
    // Query single Site
    const invoicesMDB = await BillingStorage.getInvoices(tenantID,
      { invoiceId: id },
      Constants.DB_PARAMS_SINGLE_RECORD);
    // Debug
    Logging.traceEnd(MODULE_NAME, 'getInvoice', uniqueTimerID, { id });
    return invoicesMDB.count > 0 ? invoicesMDB.result[0] : null;
  }

  public static async getInvoices(tenantID: string,
    params: {
      invoiceId?: string; search?: string; userID?: string; invoiceStatus?: BillingInvoiceStatus;
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
    const filters: ({ _id?: number; $or?: any[] } | undefined) = {};
    if (params.invoiceId) {
      filters._id = Utils.convertToInt(params.userID);
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
    if (params.invoiceStatus) {
      aggregation.push({
        $match: {
          'status': { $eq: params.invoiceStatus }
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
    Logging.traceEnd(MODULE_NAME, 'getSites', uniqueTimerID, { params });
    return {
      count: (invoicesCountMDB.length > 0 ?
        (invoicesCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : invoicesCountMDB[0].count) : 0),
      result: invoicesMDB
    };
  }

  public static async saveInvoice(tenantId: string, invoiceToSave: Partial<BillingInvoice>): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(MODULE_NAME, 'saveBilling');
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
      amount: invoiceToSave.amount,
      status: invoiceToSave.status,
      currency: invoiceToSave.currency,
      createdOn: invoiceToSave.createdOn,
      nbrOfItems: invoiceToSave.nbrOfItems
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
