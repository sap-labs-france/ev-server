import { ObjectID } from 'mongodb';
import Constants from '../../utils/Constants';
import DbLookup from '../../types/database/DBLookup';
import Utils from '../../utils/Utils';
import Configuration from '../../utils/Configuration';

const FIXED_COLLECTIONS: string[] = ['tenants', 'migrations'];

export default class DatabaseUtils {

  public static getFixedCollections(): string[] {
    return FIXED_COLLECTIONS;
  }

  public static pushCreatedLastChangedInAggregation(tenantID: string, aggregation: any[]): void {
    // Add Created By
    DatabaseUtils._pushUserInAggregation(tenantID, aggregation, 'createdBy');
    // Add Last Changed By
    DatabaseUtils._pushUserInAggregation(tenantID, aggregation, 'lastChangedBy');
  }

  public static getCollectionName(tenantID: string, collectionNameSuffix: string): string {
    let prefix = Constants.DEFAULT_TENANT;
    if (!FIXED_COLLECTIONS.includes(collectionNameSuffix) && ObjectID.isValid(tenantID)) {
      prefix = tenantID;
    }
    return `${prefix}.${collectionNameSuffix}`;
  }

  public static getNotDeletedFilter(fieldName?: string) {
    if (fieldName) {
      return JSON.parse(`[
        { "${fieldName}.deleted": { "$exists": false } },
        { "${fieldName}.deleted": false },
        { "${fieldName}.deleted": null }
      ]`);
    }
    return [
      { 'deleted': { $exists: false } },
      { 'deleted': null },
      { 'deleted': false }
    ];
  }

  static chargingStationIsInactive(chargingStation): boolean {
    let inactive = false;
    // Get Heartbeat Interval from conf
    const config = Configuration.getChargingStationConfig();
    if (config) {
      const heartbeatIntervalSecs = config.heartbeatIntervalSecs;
      // Compute against the last Heartbeat
      if (chargingStation.lastHeartBeat) {
        const inactivitySecs = Math.floor((Date.now() - chargingStation.lastHeartBeat.getTime()) / 1000);
        // Inactive?
        if (inactivitySecs > (heartbeatIntervalSecs * 5)) {
          inactive = true;
        }
      }
    }
    return inactive;
  }

  public static pushSiteLookupInAggregation(lookupParams: DbLookup) {
    DatabaseUtils.pushCollectionLookupInAggregation('sites', {
      objectIDFields: ['createdBy', 'lastChangedBy'],
      ...lookupParams
    });
  }

  public static pushUserLookupInAggregation(lookupParams: DbLookup) {
    DatabaseUtils.pushCollectionLookupInAggregation('users', {
      objectIDFields: ['createdBy', 'lastChangedBy'],
      ...lookupParams
    });
  }

  public static pushCompanyLookupInAggregation(lookupParams: DbLookup) {
    DatabaseUtils.pushCollectionLookupInAggregation('companies', {
      objectIDFields: ['createdBy', 'lastChangedBy'],
      ...lookupParams
    });
  }

  public static pushSiteAreaLookupInAggregation(lookupParams: DbLookup) {
    DatabaseUtils.pushCollectionLookupInAggregation('siteareas', {
      objectIDFields: ['siteID', 'createdBy', 'lastChangedBy'],
      ...lookupParams
    });
  }

  public static pushChargingStationLookupInAggregation(lookupParams: DbLookup) {
    DatabaseUtils.pushCollectionLookupInAggregation('chargingstations', {
      objectIDFields: ['siteAreaID', 'createdBy', 'lastChangedBy'],
      ...lookupParams
    });
  }

  public static pushCollectionLookupInAggregation(collection: string, lookupParams: DbLookup) {
    // Build Lookup's pipeline
    const pipeline: any[] = [
      { '$match': { '$expr': { '$eq': [`$${lookupParams.foreignField}`, '$$fieldVar'] } } }
    ];
    // Replace ID field
    DatabaseUtils.renameDatabaseID(pipeline);
    // Convert ObjectID fields to String
    if (lookupParams.objectIDFields) {
      for (const foreignField of lookupParams.objectIDFields) {
        DatabaseUtils.convertObjectIDToString(pipeline, foreignField);
      }
    }
    // Add Projected fields
    DatabaseUtils.projectFields(pipeline, lookupParams.projectedFields);
    // Create Lookup
    lookupParams.aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(lookupParams.tenantID, collection),
        'let': { 'fieldVar': `$${lookupParams.localField}` },
        pipeline,
        'as': lookupParams.asField
      }
    });
    // One record?
    if (lookupParams.oneToOneCardinality) {
      lookupParams.aggregation.push({
        $unwind: { path: `$${lookupParams.asField}`, preserveNullAndEmptyArrays: !lookupParams.oneToOneCardinalityNotNull }
      });
    }
  }

  static projectFields(aggregation: any[], projectedFields: string[]) {
    if (projectedFields) {
      const project = {
        $project: {}
      };
      for (const projectedField of projectedFields) {
        project.$project[projectedField] = 1;
      }
      aggregation.push(project);
    }
  }

  public static convertObjectIDToString(aggregation: any[], fieldName: string, renamedFieldName?: string) {
    if (!renamedFieldName) {
      renamedFieldName = fieldName;
    }
    // Make sure the field exists so it can be operated on
    aggregation.push(JSON.parse(`{
      "$addFields": {
        "${renamedFieldName}": {
          "$ifNull": ["$${fieldName}", null]
        }
      }
    }`));
    // Convert to string (or null)
    aggregation.push(JSON.parse(`{
      "$addFields": {
        "${renamedFieldName}": {
          "$cond": { "if": { "$gt": ["$${fieldName}", null] }, "then": { "$toString": "$${fieldName}" }, "else": null }
        }
      }
    }`));
  }

  public static renameField(aggregation: any[], fieldName: string, renamedFieldName: string) {
    // Rename
    aggregation.push(JSON.parse(`{
      "$addFields": {
        "${renamedFieldName}": "$${fieldName}"
      }
    }`));
    // Delete
    aggregation.push(JSON.parse(`{
      "$project": {
        "${fieldName}": 0
      }
    }`));
  }

  // TODO: Can probably be removed once user gets typed. For now use as shortcut.
  public static addLastChangedCreatedProps(dest: any, entity: any) {
    dest.createdBy = null;
    dest.lastChangedBy = null;
    if (entity.createdBy && entity.createdOn) {
      dest.createdBy = DatabaseUtils._mongoConvertUserID(entity, 'createdBy');
      dest.createdOn = entity.createdOn;
    }
    if (entity.lastChangedBy && entity.lastChangedOn) {
      dest.lastChangedBy = DatabaseUtils._mongoConvertUserID(entity, 'lastChangedBy');
      dest.lastChangedOn = entity.lastChangedOn;
    }
  }

  public static renameDatabaseID(aggregation: any[], nestedField?: string) {
    // Root document?
    if (!nestedField) {
      // Convert ID to string
      DatabaseUtils.convertObjectIDToString(aggregation, '_id', 'id');
      // Remove IDs
      aggregation.push({
        $project: {
          '_id': 0,
          '__v': 0
        }
      });
    } else {
      // Convert ID to string
      DatabaseUtils.convertObjectIDToString(
        aggregation, `${nestedField}._id`, `${nestedField}.id`);
      // Remove IDs
      const project = {
        $project: {}
      };
      project.$project[nestedField] = {
        '__v': 0,
        '_id': 0
      };
      aggregation.push(project);
    }
  }

  // Temporary hack to fix user Id saving. fix all this when user is typed...
  private static _mongoConvertUserID(obj: any, prop: string): ObjectID|null {
    if (!obj || !obj[prop]) {
      return null;
    }
    if (obj[prop].id) {
      return Utils.convertToObjectID(obj[prop].id);
    }
    return null;
  }

  private static _pushUserInAggregation(tenantID: string, aggregation: any[], fieldName: string) {
    // Created By Lookup
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: fieldName,
        foreignField: '_id',
        as: fieldName
      }
    });
    // Single Record
    aggregation.push({
      $unwind: { 'path': `$${fieldName}`, 'preserveNullAndEmptyArrays': true }
    });
    // Replace nested ID field
    DatabaseUtils.renameDatabaseID(aggregation, fieldName);
    // Handle null
    const addNullFields: any = {};
    addNullFields[`${fieldName}`] = { $cond : { if: { $gt: [`$${fieldName}.id`, null] }, then: `$${fieldName}`, else: null } };
    aggregation.push({ $addFields: addNullFields });
    // Project
    const projectFields: any = {};
    projectFields[`${fieldName}`] = Constants.MONGO_USER_MASK;
    aggregation.push({
      $project: projectFields
    });
  }
}
