const FIXED_COLLECTIONS = ['tenants', 'migrations'];
let masterTenantID;

class DatabaseUtils {

  static setMasterTenant(tenantID) {
    masterTenantID = tenantID;
  }

  static getMasterTenant() {
    return masterTenantID;
  }

  static getFixedCollections() {
    return FIXED_COLLECTIONS;
  }

  static pushCreatedLastChangedInAggregation(tenantID, aggregation){
    // Filter
    const filterUserFields = {
      "email": 0,
      "phone": 0,
      "mobile": 0,
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
      $unwind: {"path": "$createdBy", "preserveNullAndEmptyArrays": true}
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
      $unwind: {"path": "$lastChangedBy", "preserveNullAndEmptyArrays": true}
    });
    // Filter
    aggregation.push({
      $project: {
        "lastChangedBy": filterUserFields
      }
    });
  }

  static getCollectionName(tenantID, collectionName){
    if (FIXED_COLLECTIONS.includes(collectionName)) {
      return collectionName;
    }
    if (!tenantID) {
      tenantID = masterTenantID;
    }
    return `${tenantID}.${collectionName}`;
  }
}

module.exports = DatabaseUtils;