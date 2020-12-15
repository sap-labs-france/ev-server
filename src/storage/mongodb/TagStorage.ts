import global, { FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { OICPDefaultTagId } from '../../types/oicp/OICPIdentification';
import Tag from '../../types/Tag';
import UserStorage from './UserStorage';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'TagStorage';

export default class TagStorage {

  public static async saveTag(tenantID: string, tag: Tag): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveTag');
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
    const tagMDB = {
      _id: tag.id,
      userID: Utils.convertToObjectID(tag.userID),
      issuer: Utils.convertToBoolean(tag.issuer),
      active: Utils.convertToBoolean(tag.active),
      default: Utils.convertToBoolean(tag.default),
      ocpiToken: tag.ocpiToken,
      description: tag.description,
      deleted: Utils.objectHasProperty(tag, 'deleted') ? tag.deleted : false
    };
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(tagMDB, tag);
    // Save
    await global.database.getCollection<any>(tenantID, 'tags').findOneAndUpdate(
      { '_id': tag.id },
      { $set: tagMDB },
      { upsert: true, returnOriginal: false });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'saveTag', uniqueTimerID, tagMDB);
  }

  public static async clearDefaultUserTag(tenantID: string, userID: string): Promise<void> {
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'clearDefaultUserTag');
    await DatabaseUtils.checkTenant(tenantID);
    await global.database.getCollection<any>(tenantID, 'tags').updateMany(
      {
        userID: Utils.convertToObjectID(userID),
        default: true
      },
      {
        $set: { default: false }
      });
    Logging.traceEnd(tenantID, MODULE_NAME, 'clearDefaultUserTag', uniqueTimerID, { userID });
  }

  public static async deleteTag(tenantID: string, tagID: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteTag');
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection<any>(tenantID, 'tags').deleteOne(
      {
        '_id': tagID,
      });
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'deleteTag', uniqueTimerID, { id: tagID });
  }

  public static async getTag(tenantID: string, id: string,
    params: { withUser?: boolean; withNbrTransactions?: boolean } = {}, projectFields?: string[]): Promise<Tag> {
    const tagMDB = await TagStorage.getTags(tenantID, {
      tagIDs: [id],
      withUser: params.withUser,
      withNbrTransactions: params.withNbrTransactions,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return tagMDB.count === 1 ? tagMDB.result[0] : null;
  }

  public static async getFirstActiveUserTag(tenantID: string, userID: string,
    params: { issuer?: boolean; } = {}, projectFields?: string[]): Promise<Tag> {
    const tagMDB = await TagStorage.getTags(tenantID, {
      userIDs: [userID],
      issuer: params.issuer,
      active: true,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return tagMDB.count === 1 ? tagMDB.result[0] : null;
  }

  public static async getDefaultUserTag(tenantID: string, userID: string,
    params: { issuer?: boolean; active?: boolean; } = {}, projectFields?: string[]): Promise<Tag> {
    const tagMDB = await TagStorage.getTags(tenantID, {
      userIDs: [userID],
      issuer: params.issuer,
      active: params.active,
      defaultTag: true,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return tagMDB.count === 1 ? tagMDB.result[0] : null;
  }

  public static async getTags(tenantID: string,
    params: {
      issuer?: boolean; tagIDs?: string[]; userIDs?: string[]; dateFrom?: Date; dateTo?: Date;
      withUser?: boolean; withNbrTransactions?: boolean; search?: string, defaultTag?: boolean, active?: boolean
    },
    dbParams: DbParams, projectFields?: string[]): Promise<DataResult<Tag>> {
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getTags');
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    const filters: FilterParams = {
      '$or': DatabaseUtils.getNotDeletedFilter()
    };
    // Filter by other properties
    if (params.search) {
      const searchRegex = Utils.escapeSpecialCharsInRegex(params.search);
      filters.$or = [
        { '_id': { $regex: searchRegex, $options: 'i' } },
        { 'description': { $regex: searchRegex, $options: 'i' } }
      ];
    }
    if (!Utils.isEmptyArray(params.tagIDs)) {
      filters._id = { $in: params.tagIDs };
    }
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.userID = { $in: params.userIDs.map((userID) => Utils.convertToObjectID(userID)) };
      if (params.defaultTag) {
        filters.default = true;
      }
    }
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBooleanValue(params.issuer)) {
      filters.issuer = params.issuer;
    }
    if (Utils.objectHasProperty(params, 'active') && Utils.isBooleanValue(params.active)) {
      filters.active = params.active;
    }
    if (params.dateFrom && moment(params.dateFrom).isValid()) {
      filters.lastChangedOn = { $gte: new Date(params.dateFrom) };
    }
    if (params.dateTo && moment(params.dateTo).isValid()) {
      filters.lastChangedOn = { $lte: new Date(params.dateTo) };
    }
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({ $match: filters });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const tagsCountMDB = await global.database.getCollection<any>(tenantID, 'tags')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      Logging.traceEnd(tenantID, MODULE_NAME, 'getTags', uniqueTimerID, tagsCountMDB);
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
      let additionalPipeline :Record<string, any>[] = [];
      if (params.withUser) {
        additionalPipeline = [{
          '$match': { 'userID': { $exists: true, $ne: null } }
        }];
      }
      DatabaseUtils.pushTransactionsLookupInAggregation({
        tenantID, aggregation: aggregation, localField: '_id', foreignField: 'tagID',
        count: true, asField: 'transactionsCount', oneToOneCardinality: false,
        objectIDFields: ['createdBy', 'lastChangedBy']
      }, additionalPipeline);
    }
    // Users
    if (params.withUser) {
      DatabaseUtils.pushUserLookupInAggregation({
        tenantID, aggregation: aggregation, asField: 'user', localField: 'userID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
    }
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const tagsMDB = await global.database.getCollection<Tag>(tenantID, 'tags')
      .aggregate(aggregation, {
        allowDiskUse: true
      })
      .toArray();
    // Debug
    Logging.traceEnd(tenantID, MODULE_NAME, 'getTags', uniqueTimerID, tagsMDB);
    // Ok
    return {
      count: (tagsCountMDB.length > 0 ?
        (tagsCountMDB[0].count === Constants.DB_RECORD_COUNT_CEIL ? -1 : tagsCountMDB[0].count) : 0),
      result: tagsMDB
    };
  }

  public static async createOICPVirtualUserTags(tenantID: string): Promise<void> {
    const defaultTagIds = [OICPDefaultTagId.RemoteIdentification, OICPDefaultTagId.QRCodeIdentification, OICPDefaultTagId.PlugAndChargeIdentification];
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    defaultTagIds.forEach(async (defaultTagId) => {
      let tag = await this.getTag(tenantID, defaultTagId);
      if (!tag) {
        const virtualOICPUser = await UserStorage.getOICPVirtualUser(tenantID);
        tag = {
          id: defaultTagId,
          userID: virtualOICPUser.id,
          user: virtualOICPUser,
          description: 'Badge for OICP Remote Authorization',
          issuer: false,
          active: true,
          createdOn: new Date(),
          default: false
        } as Tag;
      } else {
        tag.active = true;
      }
      // Save
      await TagStorage.saveTag(tenantID, tag);
    });
  }
}
