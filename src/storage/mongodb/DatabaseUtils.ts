import Constants from '../../utils/Constants';
import { ObjectID } from 'mongodb';

const FIXED_COLLECTIONS: Array<string> = ['tenants', 'migrations'];

export default class DatabaseUtils {

  public static getFixedCollections(): Array<string> {
    return FIXED_COLLECTIONS;
  }

  //TODO determine type of aggregation
  public static pushCreatedLastChangedInAggregation(tenantID: string, aggregation: Array<any>): void {
    // Filter
    const filterUserFields = {
      "email": 0,
      "phone": 0,
      "mobile": 0,
      "notificationsActive": 0,
      "iNumber": 0,
      "costCenter": 0,
      "status": 0,
      "createdBy": 0,
      "createdOn": 0,
      "lastChangedBy": 0,
      "lastChangedOn": 0,
      "role": 0,
      "password": 0,
      "locale": 0,
      "deleted": 0,
      "passwordWrongNbrTrials": 0,
      "passwordBlockedUntil": 0,
      "passwordResetHash": 0,
      "eulaAcceptedOn": 0,
      "eulaAcceptedVersion": 0,
      "eulaAcceptedHash": 0,
      "image": 0,
      "address": 0
    };
    // Created By
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy"
      }
    });
    // Single Record
    aggregation.push({
      $unwind: { "path": "$createdBy", "preserveNullAndEmptyArrays": true }
    });
    // Filter
    aggregation.push({
      $project: {
        "createdBy": filterUserFields
      }
    });
    // Last Changed By
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenantID, 'users'),
        localField: "lastChangedBy",
        foreignField: "_id",
        as: "lastChangedBy"
      }
    });
    // Single Record
    aggregation.push({
      $unwind: { "path": "$lastChangedBy", "preserveNullAndEmptyArrays": true }
    });
    // Filter
    aggregation.push({
      $project: {
        "lastChangedBy": filterUserFields
      }
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
};
