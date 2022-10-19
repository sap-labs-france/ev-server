import Tenant, { TenantComponents } from '../../types/Tenant';
import global, { DatabaseCount, FilterParams, Image } from '../../types/GlobalType';

import AssetStorage from './AssetStorage';
import ChargingStationStorage from './ChargingStationStorage';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import Site from '../../types/Site';
import SiteAreaStorage from './SiteAreaStorage';
import { SiteUser } from '../../types/User';
import TransactionStorage from './TransactionStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SiteStorage';

export default class SiteStorage {
  public static async updateEntitiesWithOrganizationIDs(tenant: Tenant, companyID: string, siteID: string): Promise<number> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Update Charging Stations
    let updated = await ChargingStationStorage.updateChargingStationsWithOrganizationIDs(tenant, companyID, siteID);
    // Update Transactions
    updated += await TransactionStorage.updateTransactionsWithOrganizationIDs(tenant, companyID, siteID);
    // Update Assets
    updated += await AssetStorage.updateAssetsWithOrganizationIDs(tenant, companyID, siteID);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateEntitiesWithOrganizationIDs', startTime, { companyID, siteID });
    return updated;
  }

  public static async getSite(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID,
      params: { withCompany?: boolean, withImage?: boolean; issuer?: boolean; } = {}, projectFields?: string[]): Promise<Site> {
    const sitesMDB = await SiteStorage.getSites(tenant, {
      siteIDs: [id],
      withCompany: params.withCompany,
      withImage: params.withImage,
      issuer: params.issuer,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return sitesMDB.count === 1 ? sitesMDB.result[0] : null;
  }

  public static async getSiteImage(tenant: Tenant, id: string): Promise<Image> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Read DB
    const siteImageMDB = await global.database.getCollection<{ _id: ObjectId; image: string }>(tenant.id, 'siteimages')
      .findOne({ _id: DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSiteImage', startTime, { id }, siteImageMDB);
    return {
      id: id,
      image: siteImageMDB ? siteImageMDB.image : null
    };
  }

  public static async removeUsersFromSite(tenant: Tenant, siteID: string, userIDs: string[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Site provided?
    if (siteID) {
      // At least one User
      if (userIDs && userIDs.length > 0) {
        // Execute
        await global.database.getCollection<any>(tenant.id, 'siteusers').deleteMany({
          'userID': { $in: userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID)) },
          'siteID': DatabaseUtils.convertToObjectID(siteID)
        });
      }
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'removeUsersFromSite', startTime, userIDs);
  }

  public static async addUsersToSite(tenant: Tenant, siteID: string, userIDs: string[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Site provided?
    if (siteID) {
      // At least one User
      if (userIDs && userIDs.length > 0) {
        const siteUsers = [];
        // Create the list
        for (const userID of userIDs) {
          // Add
          siteUsers.push({
            '_id': Utils.hash(`${siteID}~${userID}`),
            'userID': DatabaseUtils.convertToObjectID(userID),
            'siteID': DatabaseUtils.convertToObjectID(siteID),
            'siteAdmin': false
          });
        }
        // Execute
        await global.database.getCollection<any>(tenant.id, 'siteusers').insertMany(siteUsers);
      }
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'addUsersToSite', startTime, userIDs);
  }

  public static async getSiteUsers(tenant: Tenant,
      params: { search?: string; siteIDs: string[]; siteOwnerOnly?: boolean },
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<SiteUser>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation: any[] = [];
    // Filter
    if (!Utils.isEmptyArray(params.siteIDs)) {
      aggregation.push({
        $match: {
          siteID: {
            $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
          }
        }
      });
    }
    if (params.siteOwnerOnly) {
      aggregation.push({
        $match: {
          siteOwner: true
        }
      });
    }
    // Users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID: tenant.id, aggregation, localField: 'userID', foreignField: '_id',
      asField: 'user', oneToOneCardinality: true, oneToOneCardinalityNotNull: true
    });
    // Filter deleted users
    aggregation.push({
      $match: {
        'user.deleted': { $ne: true }
      }
    });
    // Another match for searching on Users
    if (params.search) {
      aggregation.push({
        $match: {
          $or: [
            { 'user.name': { $regex: params.search, $options: 'i' } },
            { 'user.firstName': { $regex: params.search, $options: 'i' } },
            { 'user.email': { $regex: params.search, $options: 'i' } }
          ]
        }
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const siteUsersCountMDB = await global.database.getCollection<any>(tenant.id, 'siteusers')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSitesUsers', startTime, aggregation, siteUsersCountMDB);
      return {
        count: (siteUsersCountMDB.length > 0 ? siteUsersCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { 'user.name': 1, 'user.firstName': 1 };
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
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert IDs to String
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'siteID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const siteUsersMDB = await global.database.getCollection<any>(tenant.id, 'siteusers')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as SiteUser[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSitesUsers', startTime, aggregation, siteUsersCountMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(siteUsersCountMDB[0]),
      result: siteUsersMDB
    };
  }

  public static async updateSiteOwner(tenant: Tenant, siteID: string, userID: string, siteOwner: boolean): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    await global.database.getCollection<any>(tenant.id, 'siteusers').updateMany(
      {
        siteID: DatabaseUtils.convertToObjectID(siteID),
        siteOwner: true
      },
      {
        $set: { siteOwner: false }
      });
    await global.database.getCollection<any>(tenant.id, 'siteusers').updateOne(
      {
        siteID: DatabaseUtils.convertToObjectID(siteID),
        userID: DatabaseUtils.convertToObjectID(userID)
      },
      {
        $set: { siteOwner: siteOwner }
      });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateSiteOwner', startTime, { siteID, userID });
  }

  public static async updateSiteUserAdmin(tenant: Tenant, siteID: string, userID: string, siteAdmin: boolean): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);

    await global.database.getCollection<any>(tenant.id, 'siteusers').updateOne(
      {
        siteID: DatabaseUtils.convertToObjectID(siteID),
        userID: DatabaseUtils.convertToObjectID(userID)
      },
      {
        $set: { siteAdmin }
      });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'updateSiteUserAdmin', startTime, { siteID, userID, siteAdmin });
  }

  public static async saveSite(tenant: Tenant, siteToSave: Site, saveImage = false): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    const siteFilter: any = {};
    // Build Request
    if (siteToSave.id) {
      siteFilter._id = DatabaseUtils.convertToObjectID(siteToSave.id);
    } else {
      siteFilter._id = new ObjectId();
    }
    // Properties to save
    const siteMDB: any = {
      _id: siteFilter._id,
      issuer: Utils.convertToBoolean(siteToSave.issuer),
      public: Utils.convertToBoolean(siteToSave.public),
      companyID: DatabaseUtils.convertToObjectID(siteToSave.companyID),
      autoUserSiteAssignment: Utils.convertToBoolean(siteToSave.autoUserSiteAssignment),
      name: siteToSave.name,
      tariffID: siteToSave.tariffID,
      ownerName: siteToSave.ownerName,
    };
    if (siteToSave.address) {
      siteMDB.address = {
        address1: siteToSave.address.address1,
        address2: siteToSave.address.address2,
        postalCode: siteToSave.address.postalCode,
        city: siteToSave.address.city,
        department: siteToSave.address.department,
        region: siteToSave.address.region,
        country: siteToSave.address.country,
        coordinates: Utils.hasValidGpsCoordinates(siteToSave.address.coordinates) ? siteToSave.address.coordinates.map(
          (coordinate) => Utils.convertToFloat(coordinate)) : [],
      };
    }
    if (Utils.isTenantComponentActive(tenant, TenantComponents.BILLING_PLATFORM)) {
      if (siteToSave.accountData?.accountID) {
        siteMDB.accountData = {
          accountID: DatabaseUtils.convertToObjectID(siteToSave.accountData.accountID),
          platformFeeStrategy: {
            flatFeePerSession: siteToSave.accountData.platformFeeStrategy?.flatFeePerSession || 0,
            percentage: siteToSave.accountData.platformFeeStrategy?.percentage || 0,
          }
        };
      } else {
        siteMDB.accountData = null;
      }
    }
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(siteMDB, siteToSave);
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'sites').findOneAndUpdate(
      siteFilter,
      { $set: siteMDB },
      { upsert: true }
    );
    if (saveImage) {
      await SiteStorage.saveSiteImage(tenant, siteFilter._id.toString(), siteToSave.image);
    }
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveSite', startTime, siteMDB);
    return siteFilter._id.toString();
  }

  public static async saveSiteImage(tenant: Tenant, siteID: string, siteImageToSave: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Modify
    await global.database.getCollection<any>(tenant.id, 'siteimages').findOneAndUpdate(
      { _id: DatabaseUtils.convertToObjectID(siteID) },
      { $set: { image: siteImageToSave } },
      { upsert: true, returnDocument: 'after' }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveSiteImage', startTime, siteImageToSave);
  }

  public static async getSites(tenant: Tenant,
      params: {
        search?: string; companyIDs?: string[]; withAutoUserAssignment?: boolean; siteIDs?: string[];
        userID?: string; excludeSitesOfUserID?: string; issuer?: boolean; public?: boolean; name?: string;
        withAvailableChargingStations?: boolean; withOnlyChargingStations?: boolean; withCompany?: boolean;
        locCoordinates?: number[]; locMaxDistanceMeters?: number; withImage?: boolean;
      } = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<Site>> {
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
    // Position coordinates
    if (Utils.hasValidGpsCoordinates(params.locCoordinates)) {
      aggregation.push({
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: params.locCoordinates
          },
          distanceField: 'distanceMeters',
          maxDistance: params.locMaxDistanceMeters > 0 ? params.locMaxDistanceMeters : Constants.MAX_GPS_DISTANCE_METERS,
          spherical: true
        }
      });
    }
    // Search filters
    const filters: FilterParams = {};
    if (params.search) {
      filters.$or = [
        { 'name': { $regex: params.search, $options: 'i' } },
        { 'address.address1': { $regex: params.search, $options: 'i' } },
        { 'address.postalCode': { $regex: params.search, $options: 'i' } },
        { 'address.city': { $regex: params.search, $options: 'i' } },
        { 'address.region': { $regex: params.search, $options: 'i' } },
        { 'address.country': { $regex: params.search, $options: 'i' } },
        { 'ocpiData.location.id': { $regex: params.search, $options: 'im' } },
      ];
      if (DatabaseUtils.isObjectID(params.search)) {
        filters.$or.push({ '_id': DatabaseUtils.convertToObjectID(params.search) });
      }
    }
    // Site Name
    if (params.name) {
      filters.name = params.name;
    }
    // Site
    if (!Utils.isEmptyArray(params.siteIDs)) {
      filters._id = {
        $in: params.siteIDs.map((siteID) => DatabaseUtils.convertToObjectID(siteID))
      };
    }
    // Company
    if (!Utils.isEmptyArray(params.companyIDs)) {
      filters.companyID = {
        $in: params.companyIDs.map((company) => DatabaseUtils.convertToObjectID(company))
      };
    }
    // Issuer
    if (Utils.objectHasProperty(params, 'issuer') && Utils.isBoolean(params.issuer)) {
      filters.issuer = params.issuer;
    }
    // Public Site
    if (params.public) {
      filters.public = params.public;
    }
    // Auto User Site Assignment
    if (params.withAutoUserAssignment) {
      filters.autoUserSiteAssignment = true;
    }
    // Get users
    if (params.userID || params.excludeSitesOfUserID) {
      DatabaseUtils.pushCollectionLookupInAggregation('siteusers',
        { tenantID: tenant.id, aggregation, localField: '_id', foreignField: 'siteID', asField: 'siteusers' }
      );
      if (params.userID) {
        filters['siteusers.userID'] = DatabaseUtils.convertToObjectID(params.userID);
      }
      if (params.excludeSitesOfUserID) {
        filters['siteusers.userID'] = { $ne: DatabaseUtils.convertToObjectID(params.excludeSitesOfUserID) };
      }
    }
    // Set filters
    aggregation.push({
      $match: filters
    });
    // Charging Station Connnector stats
    if (params.withAvailableChargingStations) {
      DatabaseUtils.addConnectorStatsInOrg(tenant, aggregation, 'siteID');
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const sitesCountMDB = await global.database.getCollection<any>(tenant.id, 'sites')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSites', startTime, aggregation, sitesCountMDB);
      return {
        count: (sitesCountMDB.length > 0 ? sitesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { name: 1 };
    }
    // Position coordinates
    if (Utils.hasValidGpsCoordinates(params.locCoordinates)) {
      dbParams.sort = { distanceMeters: 1 };
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
    // Add Company
    if (params.withCompany) {
      DatabaseUtils.pushCompanyLookupInAggregation({
        tenantID: tenant.id, aggregation, localField: 'companyID', foreignField: '_id',
        asField: 'company', oneToOneCardinality: true
      });
    }
    // Site Image
    if (params.withImage) {
      aggregation.push({
        $addFields: {
          image: {
            $concat: [
              `${Utils.buildRestServerURL()}/v1/util/sites/`,
              { $toString: '$_id' },
              '/image',
              `?TenantID=${tenant.id}`,
              {
                $ifNull: [{ $concat: ['&LastChangedOn=', { $toString: '$lastChangedOn' }] }, ''] // Only concat 'lastChangedOn' if not null
              }
            ]
          }
        }
      });
    }
    // Connected account
    if (Utils.isTenantComponentActive(tenant, TenantComponents.BILLING_PLATFORM)) {
      // Account data
      DatabaseUtils.pushAccountLookupInAggregation({
        tenantID: tenant.id, aggregation,
        asField: 'accountData.account', localField: 'accountData.accountID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
      // Business Owner
      DatabaseUtils.pushUserLookupInAggregation({
        tenantID: tenant.id, aggregation: aggregation,
        asField: 'accountData.account.businessOwner',
        localField: 'accountData.account.businessOwnerID',
        foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
      });
    }
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'companyID');
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const sitesMDB = await global.database.getCollection<any>(tenant.id, 'sites')
      .aggregate(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as Site[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSites', startTime, aggregation, sitesMDB);
    return {
      projectFields: projectFields,
      count: DatabaseUtils.getCountFromDatabaseCount(sitesCountMDB[0]),
      result: sitesMDB
    };
  }

  public static async deleteSite(tenant: Tenant, id: string): Promise<void> {
    await SiteStorage.deleteSites(tenant, [id]);
  }

  public static async deleteSites(tenant: Tenant, ids: string[]): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete all Site Areas
    await SiteAreaStorage.deleteSiteAreasFromSites(tenant, ids);
    // Convert
    const cids: ObjectId[] = ids.map((id) => DatabaseUtils.convertToObjectID(id));
    // Delete Site
    await global.database.getCollection<any>(tenant.id, 'sites')
      .deleteMany({ '_id': { $in: cids } });
    // Delete Image
    await global.database.getCollection<any>(tenant.id, 'siteimages')
      .deleteMany({ '_id': { $in: cids } });
    // Delete Site's Users
    await global.database.getCollection<any>(tenant.id, 'siteusers')
      .deleteMany({ 'siteID': { $in: cids } });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteSites', startTime, { ids });
  }

  public static async deleteCompanySites(tenant: Tenant, companyID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Get Sites of Company
    const siteIDs: string[] = (await global.database.getCollection<{ _id: ObjectId }>(tenant.id, 'sites')
      .find({ companyID: DatabaseUtils.convertToObjectID(companyID) })
      .project({ _id: 1 })
      .toArray())
      .map((site): string => site._id.toString());
    // Delete all Site Areas
    await SiteAreaStorage.deleteSiteAreasFromSites(tenant, siteIDs);
    // Delete Sites
    await SiteStorage.deleteSites(tenant, siteIDs);
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteCompanySites', startTime, { companyID });
  }
}
