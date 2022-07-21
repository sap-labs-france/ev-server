import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import RegistrationToken from '../../types/RegistrationToken';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'RegistrationTokenStorage';

export default class RegistrationTokenStorage {
  public static async saveRegistrationToken(tenant: Tenant, registrationToken: RegistrationToken): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Set
    const registrationTokenMDB = {
      _id: registrationToken.id ? DatabaseUtils.convertToObjectID(registrationToken.id) : new ObjectId(),
      description: registrationToken.description,
      siteAreaID: registrationToken.siteAreaID ? DatabaseUtils.convertToObjectID(registrationToken.siteAreaID) : null,
      expirationDate: Utils.convertToDate(registrationToken.expirationDate),
      revocationDate: Utils.convertToDate(registrationToken.revocationDate)
    };
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(registrationTokenMDB, registrationToken);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'registrationtokens').findOneAndUpdate(
      { _id: registrationTokenMDB._id },
      { $set: registrationTokenMDB },
      { upsert: true, returnDocument: 'after' }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveRegistrationToken', startTime, registrationTokenMDB);
    return registrationTokenMDB._id.toString();
  }

  public static async getRegistrationTokens(tenant: Tenant,
      params: { search?: string; tokenIDs?: string[]; siteIDs?: string[]; siteAreaIDs?: string[] } = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<RegistrationToken>> {
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
    // Add Site Area
    DatabaseUtils.pushSiteAreaLookupInAggregation({
      tenantID: tenant.id, aggregation, localField: 'siteAreaID', foreignField: '_id',
      asField: 'siteArea', oneToOneCardinality: true
    });
    // Set the filters
    const filters: FilterParams = {};
    // Search
    if (params.search) {
      filters.$or = [
        { 'description': { $regex: params.search, $options: 'i' } },
      ];
      if (DatabaseUtils.isObjectID(params.search)) {
        filters.$or.push(
          { '_id': DatabaseUtils.convertToObjectID(params.search) },
        );
      }
    }
    // Build filter
    if (!Utils.isEmptyArray(params.tokenIDs)) {
      filters._id = {
        $in: params.tokenIDs.map((tokenID) => DatabaseUtils.convertToObjectID(tokenID))
      };
    }
    // Site Area
    if (!Utils.isEmptyArray(params.siteAreaIDs)) {
      filters.siteAreaID = {
        $in: params.siteAreaIDs.map((siteAreaID) => DatabaseUtils.convertToObjectID(siteAreaID))
      };
    }
    // Site
    if (!Utils.isEmptyArray(params.siteIDs)) {
      filters['siteArea.siteID'] = {
        $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
      };
    }
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
    const registrationTokensCountMDB = await global.database.getCollection<any>(tenant.id, 'registrationtokens')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getRegistrationTokens', startTime, aggregation, registrationTokensCountMDB);
      return {
        count: (registrationTokensCountMDB.length > 0 ? registrationTokensCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { expirationDate: -1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    if (dbParams.skip > 0) {
      aggregation.push({ $skip: dbParams.skip });
    }
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const registrationTokens = await global.database.getCollection<any>(tenant.id, 'registrationtokens')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as RegistrationToken[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getRegistrationTokens', startTime, aggregation, registrationTokens);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(registrationTokensCountMDB[0]),
      result: registrationTokens
    };
  }

  public static async getRegistrationToken(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID,
      params: { siteIDs?: string[]; } = {},
      projectFields?: string[]): Promise<RegistrationToken> {
    const registrationTokensMDB = await RegistrationTokenStorage.getRegistrationTokens(tenant, {
      tokenIDs: [id],
      siteIDs: params.siteIDs,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return registrationTokensMDB.count === 1 ? registrationTokensMDB.result[0] : null;
  }

  public static async deleteRegistrationToken(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    await global.database.getCollection<any>(tenant.id, 'registrationtokens')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteRegistrationToken', startTime, { id });
  }
}
