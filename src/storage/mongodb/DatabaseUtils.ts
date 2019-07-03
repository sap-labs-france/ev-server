import { filter } from 'bluebird';
import { ObjectID } from 'mongodb';
import Constants from '../../utils/Constants';
import Utils from '../../utils/Utils';

const FIXED_COLLECTIONS: string[] = ['tenants', 'migrations'];

export default class DatabaseUtils {

  public static getFixedCollections(): string[] {
    return FIXED_COLLECTIONS;
  }

  public static pushCreatedLastChangedInAggregation(tenantID: string, aggregation: any[], fieldOf: string = ''): void {
    // Filter
    const filterUserFields = {
      '_id': 0,
      '__v': 0,
      'email': 0,
      'phone': 0,
      'mobile': 0,
      'notificationsActive': 0,
      'iNumber': 0,
      'costCenter': 0,
      'status': 0,
      'createdBy': 0,
      'createdOn': 0,
      'lastChangedBy': 0,
      'lastChangedOn': 0,
      'role': 0,
      'password': 0,
      'locale': 0,
      'deleted': 0,
      'passwordWrongNbrTrials': 0,
      'passwordBlockedUntil': 0,
      'passwordResetHash': 0,
      'eulaAcceptedOn': 0,
      'eulaAcceptedVersion': 0,
      'eulaAcceptedHash': 0,
      'image': 0,
      'address': 0
    };
    // Created By
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: (fieldOf.length === 0 ? '' : fieldOf + '.') + 'createdBy',
        foreignField: '_id',
        as: (fieldOf.length === 0 ? '' : fieldOf + '.') + 'createdBy'
      }
    });

    // Single Record
    aggregation.push({
      $unwind: { 'path': `$${(fieldOf.length === 0 ? '' : fieldOf + '.')}createdBy`, 'preserveNullAndEmptyArrays': true }
    });
    // Rename id & convert to string to fit type schema
    let addFieldsContent: any = {};
    addFieldsContent[(fieldOf.length === 0 ? '' : fieldOf + '.') + 'createdBy.id'] = { $toString: `$${(fieldOf.length === 0 ? '' : fieldOf + '.')}createdBy._id` };
    aggregation.push({ $addFields: addFieldsContent });

    let projectContent: any = {};
    projectContent[(fieldOf.length === 0 ? '' : fieldOf + '.') + 'createdBy'] = filterUserFields;
    // Filter
    aggregation.push({
      $project: projectContent
    });
    // Last Changed By
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: (fieldOf.length === 0 ? '' : fieldOf + '.') + 'lastChangedBy',
        foreignField: '_id',
        as: (fieldOf.length === 0 ? '' : fieldOf + '.') + 'lastChangedBy'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: { 'path': `$${(fieldOf.length === 0 ? '' : fieldOf + '.')}lastChangedBy`, 'preserveNullAndEmptyArrays': true }
    });
    // Prep for type schema
    addFieldsContent = {};
    addFieldsContent[(fieldOf.length === 0 ? '' : fieldOf + '.') + 'lastChangedBy.id'] = { $toString: `$${(fieldOf.length === 0 ? '' : fieldOf + '.')}lastChangedBy._id` };
    aggregation.push({ $addFields: addFieldsContent });

    // Filter
    projectContent = {};
    projectContent[(fieldOf.length === 0 ? '' : fieldOf + '.') + 'lastChangedBy'] = filterUserFields;
    aggregation.push({
      $project: projectContent
    });
  }

  /**
   * Computes and returns the name of a collection.
   *
   * @param tenantID the tenant identifier of the collection
   * @param collectionNameSuffix the collection name suffix
   * @returns {String} the collection name prefixed by the tenant identifier if the collection is specific to a tenant. Returns the collection name suffix elsewhere.
   */
  public static getCollectionName(tenantID: string, collectionNameSuffix: string): string {
    let prefix = Constants.DEFAULT_TENANT;
    if (!FIXED_COLLECTIONS.includes(collectionNameSuffix) && ObjectID.isValid(tenantID)) {
      prefix = tenantID;
    }
    return `${prefix}.${collectionNameSuffix}`;
  }


  public static pushSiteAreaJoinInAggregation(tenantID: string, aggregation: any[], local: string, foreign: string, as: string, includes: string[], topCreatedProps: 'none'|'manual'|'include', single: boolean = false) {
    DatabaseUtils.pushTransformedJoinInAggregation(
      tenantID,
      aggregation,
      'siteareas',
      local,
      foreign,
      as,
      includes,
      {},
      ['address', 'name', 'maximumPower', 'image', 'siteID', 'accessControl'],
      { siteID: { $toString: `$${as}.siteID` } },
      topCreatedProps,
      true,
      single);
  }

  // WOSWOI = Without Site Without Image, bad name, change... SimpleCompany?
  public static pushCompanyWOSWOIJoinInAggregation(tenantID: string, aggregation: any[], local: string, foreign: string, as: string, includes: string[], topCreatedProps: 'none'|'manual'|'include') {
    DatabaseUtils.pushTransformedJoinInAggregation(
      tenantID,
      aggregation,
      'companies',
      local,
      foreign,
      as,
      includes,
      {},
      ['name', 'address'],
      {},
      topCreatedProps,
      true,
      true);
  }

  public static pushBasicSiteJoinInAggregation(tenantID: string, aggregation: any[], local: string, foreign: string, as: string, includes: string[], topCreatedProps: 'none'|'manual'|'include', single: boolean) {
    DatabaseUtils.pushTransformedJoinInAggregation(tenantID, aggregation, 'sites', local, foreign, as, includes, {},
      ['name', 'address', 'companyID', 'allowAllUsersToStopTransactions', 'autoUserSiteAssignment'],
      { companyID: { $toString: `$${as}.companyID` } }, topCreatedProps, true, single);
  }

  public static pushBasicUserJoinInAggregation(tenantID: string, aggregation: any[], local: string, foreign: string, as: string, includes: string[], topCreatedProps: 'none'|'manual'|'include', single: boolean) {
    this.pushTransformedJoinInAggregation(tenantID, aggregation, 'users', local, foreign, as, includes, {},
    [],
    {}, topCreatedProps, true, single);
  }

  public static pushTransformedJoinInAggregation(tenantID: string, aggregation: any[], joinCollection: string, local: string, foreign: string, intoField: string, topIncludes: string[], topRenames: any, nestedIncludes: string[],
    nestedRenames: any, topCreatedProps: 'none'|'manual'|'include', joinCreatedProps: boolean, single: boolean) {

    if (topCreatedProps === 'manual' || topCreatedProps === 'include') {
      topIncludes.push('createdBy', 'createdOn', 'lastChangedBy', 'lastChangedOn');
    }
    if (joinCreatedProps) {
      nestedIncludes.push('createdBy', 'createdOn', 'lastChangedBy', 'lastChangedOn');
    }

    const initialJoin = { $lookup: {
      from: DatabaseUtils.getCollectionName(tenantID, joinCollection),
      localField: local,
      foreignField: foreign,
      as: intoField
    } };
    const project = { $project: {
      ...topRenames } };
    const group = { $group: { _id: '$_id' } };
    for (const top of topIncludes) {
      project.$project[top] = 1;
      group.$group[top] = { $first: `$${top}` };
    }
    group.$group[intoField] = { $push: `$${intoField}` };
    project.$project[intoField] = { ...nestedRenames };
    project.$project[intoField].id = { $toString: `$${intoField}._id` };
    for (const nes of nestedIncludes) {
      project.$project[intoField][nes] = 1;
    }
    // Need to group, push users, then project to remove id
    aggregation.push(
      initialJoin,
      { $unwind: { path: `$${intoField}`, preserveNullAndEmptyArrays: true } },
      project
    );
    if (joinCreatedProps) {
      DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation, intoField);
    }

    if (!single) {
      aggregation.push(group);
    }
    aggregation.push({ $addFields: { id: '$_id' } });

    if (topCreatedProps === 'include') {
      DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    }
  } // TODO: createdBy.id gets set even if user is null, giving illusion that there is a user. Take care


  public static includeCreatedProps(obj: any) {
    obj.createdBy = 1;
    obj.createdOn = 1;
    obj.lastChangedBy = 1;
    obj.lastChangedOn = 1;
  }

  // Temporary hack to fix user Id saving. fix all this when user is typed...
  public static mongoConvertUserID(obj: any, prop: string): ObjectID|null {
    if (!obj || !obj[prop]) {
      return null;
    }
    if (obj[prop].id) {
      return Utils.convertToObjectID(obj[prop].id);
    }
    return null;
  }

  // TODO: Can probably be removed once user gets typed. For now use as shortcut.
  public static mongoConvertLastChangedCreatedProps(dest: any, entity: any) {
    if (entity.createdBy && entity.createdOn) {
      dest.createdBy = DatabaseUtils.mongoConvertUserID(entity, 'createdBy');
      dest.createdOn = entity.createdOn;
    }
    if (entity.lastChangedBy && entity.lastChangedOn) {
      dest.lastChangedBy = DatabaseUtils.mongoConvertUserID(entity, 'lastChangedBy');
      dest.lastChangedOn = entity.lastChangedOn;
    }
  }

}
