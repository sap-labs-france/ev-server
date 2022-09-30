import Tag, { ImportedTag } from '../../types/Tag';
import global, { DatabaseCount, FilterParams, ImportStatus } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'TagStorage';

export default class TagStorage {
  public static async findAvailableID(tenant: Tenant): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    let existingTag: Tag;
    do {
      // Generate new transaction ID
      const id = Utils.generateTagID();
      existingTag = await TagStorage.getTag(tenant, id);
      if (existingTag) {
        await Logging.logWarning({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'findAvailableID',
          action: ServerAction.TAG_CREATE,
          message: `Tag ID '${id}' already exists, generating a new one...`
        });
      } else {
        return id;
      }
    } while (existingTag);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'findAvailableID', startTime, {});
  }

  public static async saveTag(tenant: Tenant, tag: Tag): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const tagMDB = {
      _id: tag.id,
      userID: tag.userID ? DatabaseUtils.convertToObjectID(tag.userID) : null,
      issuer: Utils.convertToBoolean(tag.issuer),
      active: Utils.convertToBoolean(tag.active),
      default: Utils.convertToBoolean(tag.default),
      visualID: tag.visualID ?? new ObjectId().toString(),
      ocpiToken: tag.ocpiToken,
      description: tag.description,
      importedData: tag.importedData
    };
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(tagMDB, tag);
    // Save
    await global.database.getCollection<any>(tenant.id, 'tags').findOneAndUpdate(
      { '_id': tag.id },
      { $set: tagMDB },
      { upsert: true, returnDocument: 'after' });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveTag', startTime, tagMDB);
  }

  public static async saveImportedTag(tenant: Tenant, importedTagToSave: ImportedTag): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    const tagMDB = {
      _id: importedTagToSave.id,
      visualID: importedTagToSave.visualID,
      description: importedTagToSave.description,
      name: importedTagToSave.name,
      firstName: importedTagToSave.firstName,
      email: importedTagToSave.email,
      status: importedTagToSave.status,
      errorDescription: importedTagToSave.errorDescription,
      importedOn: importedTagToSave.importedOn,
      importedBy: importedTagToSave.importedBy,
      siteIDs: importedTagToSave.siteIDs,
      importedData: importedTagToSave.importedData
    };
    await global.database.getCollection<any>(tenant.id, 'importedtags').findOneAndUpdate(
      { _id: tagMDB._id },
      { $set: tagMDB },
      { upsert: true, returnDocument: 'after' }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveImportedTag', startTime, tagMDB);
    return tagMDB._id;
  }

  public static async saveImportedTags(tenant: Tenant, importedTagsToSave: ImportedTag[]): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    const importedTagsToSaveMDB: any = importedTagsToSave.map((importedTagToSave) => ({
      _id: importedTagToSave.id,
      visualID: importedTagToSave.visualID,
      description: importedTagToSave.description,
      name: importedTagToSave.name,
      firstName: importedTagToSave.firstName,
      email: importedTagToSave.email,
      status: importedTagToSave.status,
      errorDescription: importedTagToSave.errorDescription,
      importedOn: importedTagToSave.importedOn,
      importedBy: importedTagToSave.importedBy,
      siteIDs: importedTagToSave.siteIDs,
      importedData: importedTagToSave.importedData
    }));
    // Insert all at once
    const result = await global.database.getCollection<any>(tenant.id, 'importedtags').insertMany(
      importedTagsToSaveMDB,
      { ordered: false }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveImportedTags', startTime, importedTagsToSave);
    return result.insertedCount;
  }

  public static async deleteImportedTag(tenant: Tenant, importedTagID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'importedtags').deleteOne(
      {
        '_id': importedTagID,
      });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteImportedTag', startTime, { id: importedTagID });
  }

  public static async deleteImportedTags(tenant: Tenant): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'importedtags').deleteMany({});
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteImportedTags', startTime, {});
  }

  public static async getImportedTagsCount(tenant: Tenant): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Count documents
    const nbrOfDocuments = await global.database.getCollection<any>(tenant.id, 'importedtags').countDocuments();
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getImportedTagsCount', startTime, {});
    return nbrOfDocuments;
  }

  public static async getImportedTags(tenant: Tenant,
      params: { status?: ImportStatus; search?: string },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<ImportedTag>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    const filters: FilterParams = {};
    // Create Aggregation
    const aggregation = [];
    // Filter
    if (params.search) {
      filters.$or = [
        { '_id': { $regex: params.search, $options: 'i' } },
        { 'description': { $regex: params.search, $options: 'i' } }
      ];
    }
    // Status
    if (params.status) {
      filters.status = params.status;
    }
    // Add filters
    aggregation.push({
      $match: filters
    });
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const tagsImportCountMDB = await global.database.getCollection<any>(tenant.id, 'importedtags')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getImportedTags', startTime, aggregation, tagsImportCountMDB);
      return {
        count: (tagsImportCountMDB.length > 0 ? tagsImportCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { status: -1, name: 1, firstName: 1 };
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
    // Change ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'importedBy');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const tagsImportMDB = await global.database.getCollection<any>(tenant.id, 'importedtags')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as ImportedTag[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getImportedTags', startTime, aggregation, tagsImportMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(tagsImportCountMDB[0]),
      result: tagsImportMDB
    };
  }

  public static async clearDefaultUserTag(tenant: Tenant, userID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    await global.database.getCollection<any>(tenant.id, 'tags').updateMany(
      {
        userID: DatabaseUtils.convertToObjectID(userID),
        default: true
      },
      {
        $set: { default: false }
      });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'clearDefaultUserTag', startTime, { userID });
  }

  public static async deleteTag(tenant: Tenant, tagID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    await global.database.getCollection<any>(tenant.id, 'tags').deleteOne(
      {
        '_id': tagID,
      }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteTag', startTime, { id: tagID });
  }

  public static async deleteTagsByUser(tenant: Tenant, userID: string): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete
    const result = await global.database.getCollection<any>(tenant.id, 'tags').deleteMany(
      {
        'userID': DatabaseUtils.convertToObjectID(userID),
      }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteTagsByUser', startTime, { id: userID });
    return result.deletedCount;
  }

  public static async getTag(tenant: Tenant, id: string,
      params: { userIDs?: string[], withUser?: boolean, withNbrTransactions?: boolean, active?: boolean, siteIDs?: string[], issuer?: boolean } = {},
      projectFields?: string[]): Promise<Tag> {
    const tagMDB = await TagStorage.getTags(tenant, {
      tagIDs: [id],
      withUser: params.withUser,
      withNbrTransactions: params.withNbrTransactions,
      userIDs: params.userIDs,
      active: params.active,
      siteIDs: params.siteIDs,
      issuer: params.issuer,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return tagMDB.count === 1 ? tagMDB.result[0] : null;
  }

  public static async getTagByVisualID(tenant: Tenant, visualID: string,
      params: { withUser?: boolean, withNbrTransactions?: boolean, userIDs?: string[], issuer?: boolean } = {}, projectFields?: string[]): Promise<Tag> {
    const tagMDB = await TagStorage.getTags(tenant, {
      visualIDs: [visualID],
      withUser: params.withUser,
      withNbrTransactions: params.withNbrTransactions,
      userIDs: params.userIDs,
      issuer: params.issuer
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return tagMDB.count === 1 ? tagMDB.result[0] : null;
  }

  public static async getFirstActiveUserTag(tenant: Tenant, userID: string,
      params: { issuer?: boolean; } = {}, projectFields?: string[]): Promise<Tag> {
    const tagMDB = await TagStorage.getTags(tenant, {
      userIDs: [userID],
      issuer: params.issuer,
      active: true,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return tagMDB.count > 0 ? tagMDB.result[0] : null;
  }

  public static async getDefaultUserTag(tenant: Tenant, userID: string,
      params: { issuer?: boolean; active?: boolean; } = {}, projectFields?: string[]): Promise<Tag> {
    const tagMDB = await TagStorage.getTags(tenant, {
      userIDs: [userID],
      issuer: params.issuer,
      active: params.active,
      defaultTag: true,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return tagMDB.count === 1 ? tagMDB.result[0] : null;
  }

  public static async getTags(tenant: Tenant,
      params: {
        issuer?: boolean; tagIDs?: string[]; visualIDs?: string[]; userIDs?: string[]; siteIDs?: string[]; dateFrom?: Date; dateTo?: Date;
        withUser?: boolean; withUsersOnly?: boolean; withNbrTransactions?: boolean; search?: string, defaultTag?: boolean, active?: boolean;
      },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<Tag>> {
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
    const filters: FilterParams = {};
    // Filter by other properties
    if (params.search) {
      filters.$text = { $search: `"${params.search}"` };
    }
    // Tag IDs
    if (!Utils.isEmptyArray(params.tagIDs)) {
      filters._id = { $in: params.tagIDs };
    }
    // Visual Tag IDs
    if (!Utils.isEmptyArray(params.visualIDs)) {
      filters.visualID = { $in: params.visualIDs };
    }
    // Users
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.userID = { $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID)) };
    }
    // Default Tag
    if (params.defaultTag) {
      filters.default = true;
    }
    // Issuer
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBoolean(params.issuer)) {
      filters.issuer = params.issuer;
    }
    // With Users only
    if (params.withUsersOnly) {
      filters.userID = { $exists: true, $ne: null };
    }
    // Active
    if (Utils.objectHasProperty(params, 'active') && Utils.isBoolean(params.active)) {
      filters.active = params.active;
    }
    // Dates
    if ((params.dateFrom && moment(params.dateFrom).isValid()) ||
        (params.dateTo && moment(params.dateTo).isValid())) {
      const lastChangedOn: any = {};
      const createdOn: any = {};
      if (params.dateFrom) {
        lastChangedOn.$gte = Utils.convertToDate(params.dateFrom);
        createdOn.$gte = Utils.convertToDate(params.dateFrom);
      }
      if (params.dateTo) {
        lastChangedOn.$lte = Utils.convertToDate(params.dateTo);
        createdOn.$lte = Utils.convertToDate(params.dateTo);
      }
      filters.$or = [
        { lastChangedOn },
        { createdOn },
      ];
    }
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({ $match: filters });
    }
    // Sites
    if (!Utils.isEmptyArray(params.siteIDs)) {
      DatabaseUtils.pushSiteUserLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'userID', foreignField: 'userID', asField: 'siteUsers'
      });
      aggregation.push({
        $match: { 'siteUsers.siteID': { $in: params.siteIDs.map((site) => DatabaseUtils.convertToObjectID(site)) } }
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const tagsCountMDB = await global.database.getCollection<any>(tenant.id, 'tags')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTags', startTime, aggregation, tagsCountMDB);
      return {
        count: (tagsCountMDB.length > 0 ? tagsCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    if (!dbParams.sort) {
      dbParams.sort = { createdOn: -1 };
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
    // Transactions
    if (params.withNbrTransactions) {
      let additionalPipeline: Record<string, any>[] = [];
      if (params.withUser) {
        additionalPipeline = [{
          '$match': { 'userID': { $exists: true, $ne: null } }
        }];
      }
      DatabaseUtils.pushTransactionsLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, localField: '_id', foreignField: 'tagID',
        count: true, asField: 'transactionsCount', oneToOneCardinality: false,
        objectIDFields: ['createdBy', 'lastChangedBy']
      }, additionalPipeline);
    }
    // Users
    if (params.withUser) {
      DatabaseUtils.pushUserLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation, asField: 'user', localField: 'userID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
    }
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const tagsMDB = await global.database.getCollection<any>(tenant.id, 'tags')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Tag[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTags', startTime, aggregation, tagsMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(tagsCountMDB[0]),
      result: tagsMDB,
      projectFields: projectFields
    };
  }
}
