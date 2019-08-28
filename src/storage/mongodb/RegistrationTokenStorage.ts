import { ObjectID } from 'mongodb';
import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import global from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import RegistrationToken from '../../types/RegistrationToken';
import Utils from '../../utils/Utils';
import { DataResult } from '../../types/DataResult';

export default class RegistrationTokenStorage {
  static async saveRegistrationToken(tenantID: string, registrationToken: RegistrationToken): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart('RegistrationTokenStorage', 'saveRegistrationToken');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Set
    const registrationTokenMDB = {
      _id: !registrationToken.id ? new ObjectID() : Utils.convertToObjectID(registrationToken.id),
      description: registrationToken.description,
      siteAreaID: registrationToken.siteAreaID ? Utils.convertToObjectID(registrationToken.siteAreaID) : null,
      expirationDate: registrationToken.expirationDate,
      revocationDate: registrationToken.revocationDate
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(registrationTokenMDB, registrationToken);
    // Modify
    await global.database.getCollection<RegistrationTokenStorage>(tenantID, 'registrationtokens').findOneAndUpdate(
      { _id: registrationTokenMDB._id },
      { $set: registrationTokenMDB },
      { upsert: true, returnOriginal: false }
    );
    // Debug
    Logging.traceEnd('RegistrationTokenStorage', 'saveRegistrationToken', uniqueTimerID, { registrationToken });
    return registrationTokenMDB._id.toHexString();
  }

  static async getRegistrationTokens(tenantID: string,
      params: { id?: string; siteIDs?: string; siteAreaID?: string } = {}, dbParams: DbParams):
      Promise<DataResult<RegistrationToken>> {
    // Debug
    const uniqueTimerID = Logging.traceStart('RegistrationTokenStorage', 'getRegistrationTokens');
    // Check Tenant
    await Utils.checkTenant(tenantID);
    // Check Limit
    const limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    const skip = Utils.checkRecordSkip(dbParams.skip);

    // Set the filters
    const filters: any = {};
    // Build filter
    if (params.siteAreaID) {
      filters.siteAreaID = Utils.convertToObjectID(params.siteAreaID);
    }
    // Build filter
    if (params.id) {
      filters._id = Utils.convertToObjectID(params.id);
    }

    if (params.siteIDs && Array.isArray(params.siteIDs) && params.siteIDs.length > 0) {
      // Build filter
      filters['siteArea.siteID'] = {
        $in: params.siteIDs
      };
    }

    // Create Aggregation
    const aggregation = [];

    DatabaseUtils.pushSiteAreaLookupInAggregation(
      {
        tenantID,
        aggregation,
        localField: 'siteAreaID',
        foreignField: '_id',
        asField: 'siteArea',
        oneToOneCardinality: true
      });

    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }

    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const registrationTokensCountMDB = await global.database.getCollection<DataResult<RegistrationToken>>(tenantID, 'registrationtokens')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      return {
        count: (registrationTokensCountMDB.length > 0 ? registrationTokensCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();

    // Handle the ID
    DatabaseUtils.renameDatabaseID(aggregation);
    // Sort
    if (dbParams.sort) {
      // Sort
      aggregation.push({
        $sort: dbParams.sort
      });
    } else {
      // Default
      aggregation.push({
        $sort: { expirationDate: -1 }
      });
    }
    // Skip
    if (skip > 0) {
      aggregation.push({ $skip: skip });
    }
    // Limit
    aggregation.push({
      $limit: (limit > 0 && limit < Constants.DB_RECORD_COUNT_CEIL) ? limit : Constants.DB_RECORD_COUNT_CEIL
    });

    // Read DB
    const registrationTokens = await global.database.getCollection<any>(tenantID, 'registrationtokens')
      .aggregate(aggregation, {
        collation: { locale: Constants.DEFAULT_LOCALE, strength: 2 },
        allowDiskUse: true
      })
      .toArray();

    // Debug
    Logging.traceEnd('RegistrationTokenStorage', 'getRegistrationTokens', uniqueTimerID,
      { params, limit: dbParams.limit, skip: dbParams.skip, sort: dbParams.sort });
    // Ok
    return {
      count: (registrationTokensCountMDB.length > 0 ?
        (registrationTokensCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : registrationTokensCountMDB[0].count) : 0),
      result: registrationTokens
    };
  }

  static async getRegistrationToken(tenantID: string, id: string): Promise<RegistrationToken> {
    // Debug
    const uniqueTimerID = Logging.traceStart('RegistrationTokenStorage', 'getRegistrationToken');
    // Reuse
    const registrationTokens = await RegistrationTokenStorage.getRegistrationTokens(tenantID, { id: id }, Constants.DB_PARAMS_SINGLE_RECORD);
    let registrationToken: RegistrationToken = null;
    // Check
    if (registrationTokens && registrationTokens.count > 0) {
      registrationToken = registrationTokens.result[0];
    }
    // Debug
    Logging.traceEnd('RegistrationTokenStorage', 'getRegistrationToken', uniqueTimerID, { id });
    return registrationToken;
  }

  static async deleteRegistrationToken(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart('RegistrationTokenStorage', 'deleteRegistrationToken');
    await global.database.getCollection<any>(tenantID, 'registrationtokens')
      .findOneAndDelete({ '_id': Utils.convertToObjectID(id) });
    // Debug
    Logging.traceEnd('RegistrationTokenStorage', 'deleteRegistrationToken', uniqueTimerID, { id });
  }
}
