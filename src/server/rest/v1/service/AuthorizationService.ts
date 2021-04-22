import { Action, AuthorizationActions, AuthorizationContext, AuthorizationFilter, Entity } from '../../../../types/Authorization';
import { CompanyDataResult, SiteAreaDataResult, SiteDataResult } from '../../../../types/DataResult';
import { HttpAssignAssetsToSiteAreaRequest, HttpAssignChargingStationToSiteAreaRequest, HttpSiteAreaRequest, HttpSiteAreasRequest } from '../../../../types/requests/HttpSiteAreaRequest';
import { HttpCompaniesRequest, HttpCompanyRequest } from '../../../../types/requests/HttpCompanyRequest';
import { HttpSiteAssignUsersRequest, HttpSiteRequest, HttpSiteUsersRequest } from '../../../../types/requests/HttpSiteRequest';
import { HttpTagsRequest, HttpUserAssignSitesRequest, HttpUserRequest, HttpUserSitesRequest, HttpUsersRequest } from '../../../../types/requests/HttpUserRequest';
import User, { UserRole } from '../../../../types/User';

import AppAuthError from '../../../../exception/AppAuthError';
import AssetStorage from '../../../../storage/mongodb/AssetStorage';
import Authorizations from '../../../../authorization/Authorizations';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import Company from '../../../../types/Company';
import Constants from '../../../../utils/Constants';
import DynamicAuthorizationFactory from '../../../../authorization/DynamicAuthorizationFactory';
import { HTTPAuthError } from '../../../../types/HTTPError';
import { HttpAssetsRequest } from '../../../../types/requests/HttpAssetRequest';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpChargingStationRequest } from '../../../../types/requests/HttpChargingStationRequest';
import { ServerAction } from '../../../../types/Server';
import Site from '../../../../types/Site';
import SiteArea from '../../../../types/SiteArea';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import Tenant from '../../../../types/Tenant';
import TenantComponents from '../../../../types/TenantComponents';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';
import _ from 'lodash';

const MODULE_NAME = 'AuthorizationService';

export default class AuthorizationService {
  public static canPerfomAction(entity: AuthorizationActions, authAction: Action): boolean {
    switch (authAction) {
      case Action.READ:
        return entity.canRead;
      case Action.UPDATE:
        return entity.canUpdate;
      case Action.CREATE:
        return entity.canCreate;
      case Action.DELETE:
        return entity.canDelete;
      default:
        return false;
    }
  }

  public static async checkAndGetSiteAuthorizationFilters(tenant: Tenant, userToken: UserToken,
      filteredRequest: HttpSiteRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static auth
    const authorizationContext: AuthorizationContext = {};
    const authResult = await Authorizations.canReadSite(userToken, authorizationContext);
    authorizationFilters.authorized = authResult.authorized;
    // Check
    if (!authorizationFilters.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: userToken,
        action: Action.READ, entity: Entity.SITE,
        module: MODULE_NAME, method: 'checkAndGetSiteAuthorizationFilters',
      });
    }
    // Process dynamic filters
    await AuthorizationService.processDynamicFilters(tenant, userToken, Action.READ, Entity.SITE,
      authorizationFilters, authorizationContext, { SiteID: filteredRequest.ID });
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authResult.fields, filteredRequest.ProjectFields);
    return authorizationFilters;
  }

  public static async addSitesAuthorizations(tenant: Tenant, userToken: UserToken, sites: SiteDataResult, authorizationFilter: AuthorizationFilter,
      filteredRequest: Record<string, any>): Promise<void> {
    // Add canCreate flag to root
    sites.canCreate = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE, Action.CREATE, authorizationFilter);

    // Enrich
    for (const site of sites.result) {
      await AuthorizationService.addSiteAuthorizations(tenant, userToken, site, authorizationFilter, filteredRequest);
    }
  }

  public static async addSiteAuthorizations(tenant: Tenant, userToken: UserToken, site: Site, authorizationFilter: AuthorizationFilter,
      filteredRequest: Record<string, any>): Promise<void> {
    // Enrich
    if (!site.issuer) {
      site.canRead = true;
      site.canUpdate = false;
      site.canDelete = false;
      site.canAssignUsers = false;
      site.canUnassignUsers = false;
    } else {
      filteredRequest.SiteID = site.id;
      site.canRead = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE, Action.READ, authorizationFilter, filteredRequest);
      site.canDelete = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE, Action.DELETE, authorizationFilter, filteredRequest);
      site.canUpdate = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE, Action.UPDATE, authorizationFilter, filteredRequest);
      site.canAssignUsers = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.USERS_SITES, Action.ASSIGN,
        authorizationFilter, filteredRequest);
      site.canUnassignUsers = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.USERS_SITES, Action.UNASSIGN,
        authorizationFilter, filteredRequest);
    }
  }

  public static async checkAndGetSitesAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpSiteUsersRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITES, Action.LIST, authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async checkAndGetSiteUsersAuthorizationFilters(tenant: Tenant, userToken: UserToken,
      filteredRequest: Record<string, any>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [ ],
      authorized: false,
    };
    // Check static auth
    const authorizationContext: AuthorizationContext = {};
    const authResult = await Authorizations.canListUsersSites(userToken, authorizationContext);
    authorizationFilters.authorized = authResult.authorized;
    // Check
    if (!authorizationFilters.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: userToken,
        action: Action.READ, entity: Entity.USERS_SITES,
        module: MODULE_NAME, method: 'checkAndGetSiteUsersAuthorizationFilters',
      });
    }
    // Process dynamic filters
    await AuthorizationService.processDynamicFilters(tenant, userToken, Action.READ, Entity.USERS_SITES,
      authorizationFilters, authorizationContext, { SiteID: filteredRequest.SiteID });
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authResult.fields, filteredRequest.ProjectFields);
    return authorizationFilters;
  }

  public static async checkAndGetUserSitesAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpUserSitesRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [
        'site.id', 'site.name', 'site.address.city', 'site.address.country', 'siteAdmin', 'siteOwner', 'userID'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authorizationFilters.projectFields, filteredRequest.ProjectFields);
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdminsAndOwners(
      tenant, userToken, null, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAssignSiteUsersAuthorizationFilters(
      tenant: Tenant, action: ServerAction, userToken: UserToken, filteredRequest: HttpSiteAssignUsersRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static auth
    const authorizationContext: AuthorizationContext = {};
    const authResult = action === ServerAction.ADD_USERS_TO_SITE ?
      await Authorizations.canAssignUsersSites(userToken, authorizationContext) :
      await Authorizations.canUnassignUsersSites(userToken, authorizationContext);
    authorizationFilters.authorized = authResult.authorized;
    // Check
    if (!authorizationFilters.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: userToken,
        action: action === ServerAction.ADD_USERS_TO_SITE ? Action.ASSIGN : Action.UNASSIGN,
        entity: Entity.USERS_SITES,
        module: MODULE_NAME, method: 'checkAssignSiteUsersAuthorizationFilters',
      });
    }
    // Process dynamic filters
    await AuthorizationService.processDynamicFilters(tenant, userToken, Action.READ, Entity.SITE,
      authorizationFilters, authorizationContext, { SiteID: filteredRequest.siteID });
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authResult.fields, filteredRequest.ProjectFields);
    return authorizationFilters;
  }

  public static async checkAssignSiteAreaAssetsAuthorizationFilters(
      tenant: Tenant, action: ServerAction, userToken: UserToken, siteArea: SiteArea, filteredRequest: HttpAssignAssetsToSiteAreaRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      // Get Site IDs for which user is admin from db
      const siteAdminSiteIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
      // Check Site
      if (!Utils.isEmptyArray(siteAdminSiteIDs) && siteAdminSiteIDs.includes(siteArea.siteID)) {
        // Site Authorized, now check Assets
        if (!Utils.isEmptyArray(filteredRequest.assetIDs)) {
          let foundInvalidAssetID = false;
          // Get Asset IDs already assigned to the site
          const assetIDs = await AuthorizationService.getAssignedAssetIDs(tenant.id, siteArea.siteID);
          // Check if any of the Assets we want to unassign are missing
          for (const assetID of filteredRequest.assetIDs) {
            switch (action) {
              case ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA:
                if (assetIDs.includes(assetID)) {
                  foundInvalidAssetID = true;
                }
                break;
              case ServerAction.REMOVE_CHARGING_STATIONS_FROM_SITE_AREA:
                if (!assetIDs.includes(assetID)) {
                  foundInvalidAssetID = true;
                }
                break;
            }
          }
          if (!foundInvalidAssetID) {
            authorizationFilters.authorized = true;
          }
        }
      }
    }
    return authorizationFilters;
  }

  public static async checkAssignSiteAreaChargingStationsAuthorizationFilters(
      tenant: Tenant, action: ServerAction, userToken: UserToken, siteArea: SiteArea,
      filteredRequest: HttpAssignChargingStationToSiteAreaRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      // Get Site IDs for which user is admin from db
      const siteAdminSiteIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
      // Check Site
      if (!Utils.isEmptyArray(siteAdminSiteIDs) && siteAdminSiteIDs.includes(siteArea.siteID)) {
        // Site Authorized, now check Assets
        if (!Utils.isEmptyArray(filteredRequest.chargingStationIDs)) {
          let foundInvalidChargingStationID = false;
          // Get Charging Station IDs already assigned to the Site
          const chargingStationIDs = await AuthorizationService.getAssignedChargingStationIDs(tenant.id, siteArea.siteID);
          // Check if any of the Charging Stations we want to unassign are missing
          for (const chargingStationID of filteredRequest.chargingStationIDs) {
            switch (action) {
              case ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA:
                if (chargingStationIDs.includes(chargingStationID)) {
                  foundInvalidChargingStationID = true;
                }
                break;
              case ServerAction.REMOVE_CHARGING_STATIONS_FROM_SITE_AREA:
                if (!chargingStationIDs.includes(chargingStationID)) {
                  foundInvalidChargingStationID = true;
                }
                break;
            }
          }
          if (!foundInvalidChargingStationID) {
            authorizationFilters.authorized = true;
          }
        }
      }
    }
    return authorizationFilters;
  }

  public static async checkAndAssignUserSitesAuthorizationFilters(
      tenant: Tenant, action: ServerAction, userToken: UserToken, filteredRequest: HttpUserAssignSitesRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
        // Get Site IDs from Site Admin flag
        const siteAdminSiteIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
        // Get User IDs from Site Admin flag
        if (!Utils.isEmptyArray(siteAdminSiteIDs)) {
          // Check Sites
          if (!Utils.isEmptyArray(filteredRequest.siteIDs)) {
            let foundInvalidUserID = false;
            // Check
            for (const siteID of filteredRequest.siteIDs) {
              if (!siteAdminSiteIDs.includes(siteID)) {
                foundInvalidUserID = true;
                break;
              }
            }
            if (!foundInvalidUserID) {
              authorizationFilters.authorized = true;
            }
          }
        }
      } else {
        authorizationFilters.authorized = true;
      }
    }
    return authorizationFilters;
  }

  public static async checkAndGetUsersInErrorAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpUsersRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [
        'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer',
        'createdOn', 'lastChangedOn', 'errorCodeDetails', 'errorCode'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authorizationFilters.projectFields, filteredRequest.ProjectFields);
    // Get authorization filters from users
    const usersAuthorizationFilters = await AuthorizationService.checkAndGetUsersAuthorizationFilters(
      tenant, userToken, filteredRequest);
    // Override
    authorizationFilters.authorized = usersAuthorizationFilters.authorized;
    authorizationFilters.filters = usersAuthorizationFilters.filters;
    return authorizationFilters;
  }

  public static async addUsersAuthorizations(tenant: Tenant, userToken: UserToken, users: User[], authorizationFilter: AuthorizationFilter): Promise<void> {
    // Enrich
    for (const user of users) {
      await AuthorizationService.addUserAuthorizations(tenant, userToken, user, authorizationFilter);
    }
  }

  public static async addUserAuthorizations(tenant: Tenant, userToken: UserToken, user: User, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Enrich
    if (!user.issuer) {
      user.canRead = true;
      user.canUpdate = false;
      user.canDelete = false;
    } else {
      user.canRead = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.USER, Action.READ, authorizationFilter);
      user.canUpdate = await Authorizations.canUpdateUser(userToken, user.id);
      user.canDelete = await Authorizations.canDeleteUser(userToken, user.id);
    }
  }

  public static async checkAndGetUsersAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpUsersRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [
        'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'createdOn', 'createdBy',
        'lastChangedOn', 'lastChangedBy', 'eulaAcceptedOn', 'eulaAcceptedVersion', 'locale',
        'billingData.customerID', 'billingData.lastChangedOn'
      ],
      authorized: userToken.role === UserRole.ADMIN || userToken.role === UserRole.SUPER_ADMIN,
    };
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authorizationFilters.projectFields, filteredRequest.ProjectFields);
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdminsAndOwners(
      tenant, userToken, filteredRequest, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAndGetAssetsAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpAssetsRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [
        'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
        'dynamicAsset', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authorizationFilters.projectFields, filteredRequest.ProjectFields);
    // Handle Sites
    await AuthorizationService.checkAssignedSites(
      tenant, userToken, filteredRequest, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAndGetUserAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpUserRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static auth
    const authorizationContext: AuthorizationContext = {};
    const authResult = await Authorizations.canReadUser(userToken, authorizationContext);
    authorizationFilters.authorized = authResult.authorized;
    // Check
    if (!authorizationFilters.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: userToken,
        action: Action.READ, entity: Entity.USER,
        module: MODULE_NAME, method: 'checkAndGetUserAuthorizationFilters',
      });
    }
    // Process dynamic filters
    await AuthorizationService.processDynamicFilters(tenant, userToken, Action.READ, Entity.USER,
      authorizationFilters, authorizationContext, { UserID: filteredRequest.ID });
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authResult.fields, filteredRequest.ProjectFields);
    return authorizationFilters;
  }

  public static async checkAndGetTagsAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpTagsRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [
        'id', 'userID', 'active', 'ocpiToken', 'description', 'issuer', 'default',
        'createdOn', 'lastChangedOn'
      ],
      authorized: userToken.role === UserRole.ADMIN || userToken.role === UserRole.SUPER_ADMIN,
    };
    if (await Authorizations.canListUsers(userToken)) {
      authorizationFilters.projectFields.push('userID', 'user.id', 'user.name', 'user.firstName', 'user.email',
        'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName');
    }
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authorizationFilters.projectFields, filteredRequest.ProjectFields);
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdminsAndOwners(
      tenant, userToken, null, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAndGetTagAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpByIDRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: ['id', 'userID', 'issuer', 'active', 'description', 'default', 'user.id', 'user.name', 'user.firstName', 'user.email'],
      authorized: userToken.role === UserRole.ADMIN || userToken.role === UserRole.SUPER_ADMIN,
    };
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authorizationFilters.projectFields, filteredRequest.ProjectFields);
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdminsAndOwners(
      tenant, userToken, null, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAndGetCompaniesAuthorizationFilters(tenant: Tenant, userToken: UserToken,
      filteredRequest: HttpCompaniesRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(
      tenant, userToken, Entity.COMPANIES, Action.LIST, authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async addCompaniesAuthorizations(tenant: Tenant, userToken: UserToken,
      companies: CompanyDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add canCreate flag to root
    companies.canCreate = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.COMPANY, Action.CREATE, authorizationFilter);
    // Enrich
    for (const company of companies.result) {
      await AuthorizationService.addCompanyAuthorizations(tenant, userToken, company, authorizationFilter);
    }
  }

  public static async addCompanyAuthorizations(tenant: Tenant, userToken: UserToken, company: Company, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Enrich
    if (!company.issuer) {
      company.canRead = true;
      company.canUpdate = false;
      company.canDelete = false;
    } else {
      company.canRead = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.COMPANY, Action.READ, authorizationFilter);
      company.canDelete = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.COMPANY, Action.DELETE, authorizationFilter);
      company.canUpdate = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.COMPANY, Action.UPDATE, authorizationFilter);
    }
  }

  public static async checkAndGetCompanyAuthorizationFilters(tenant: Tenant, userToken: UserToken,
      filteredRequest: HttpCompanyRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static auth
    const authorizationContext: AuthorizationContext = {};
    const authResult = await Authorizations.canReadCompany(userToken, authorizationContext);
    authorizationFilters.authorized = authResult.authorized;
    // Check
    if (!authorizationFilters.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: userToken,
        action: Action.READ, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'checkAndGetCompanyAuthorizationFilters',
      });
    }
    // Process dynamic filters
    await AuthorizationService.processDynamicFilters(tenant, userToken, Action.READ, Entity.COMPANY,
      authorizationFilters, authorizationContext, { CompanyID: filteredRequest.ID });
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authResult.fields, filteredRequest.ProjectFields);
    return authorizationFilters;
  }

  public static async checkAndGetSiteAreaAuthorizationFilters(tenant: Tenant, userToken: UserToken, filteredRequest: HttpSiteAreaRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [
        'id', 'name', 'issuer', 'image', 'address', 'maximumPower', 'numberOfPhases',
        'voltage', 'smartCharging', 'accessControl', 'connectorStats', 'siteID', 'site.name'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authorizationFilters.projectFields, filteredRequest.ProjectFields);
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      const siteAreaIDs = await AuthorizationService.getAssignedSiteAreaIDs(tenant.id, userToken);
      if (!Utils.isEmptyArray(siteAreaIDs) && siteAreaIDs.includes(filteredRequest.ID)) {
        authorizationFilters.authorized = true;
      }
    }
    return authorizationFilters;
  }

  public static async checkAndGetSiteAreasAuthorizationFilters(tenant: Tenant, userToken: UserToken, filteredRequest: HttpSiteAreasRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [
        'id', 'name', 'siteID', 'maximumPower', 'voltage', 'numberOfPhases', 'accessControl', 'smartCharging', 'address',
        'site.id', 'site.name', 'issuer', 'distanceMeters', 'createdOn', 'createdBy', 'lastChangedOn', 'lastChangedBy'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authorizationFilters.projectFields, filteredRequest.ProjectFields);
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      // Get assigned SiteArea IDs
      const siteAreaIDs = await AuthorizationService.getAssignedSiteAreaIDs(tenant.id, userToken);
      if (!Utils.isEmptyArray(siteAreaIDs)) {
        // Force the filter
        authorizationFilters.filters.siteAreaIDs = siteAreaIDs;
        // Check if filter is provided
        if (Utils.objectHasProperty(filteredRequest, 'SiteAreaID') &&
              !Utils.isNullOrUndefined(filteredRequest['SiteAreaID'])) {
          const filteredSiteAreaIDs: string[] = filteredRequest['SiteAreaID'].split('|');
          // Override
          authorizationFilters.filters.siteAreaIDs = filteredSiteAreaIDs.filter(
            (siteAreaID) => authorizationFilters.filters.siteAreaIDs.includes(siteAreaID));
        }
      }
      if (!Utils.isEmptyArray(authorizationFilters.filters.siteAreaIDs)) {
        authorizationFilters.authorized = true;
      }
    }

    return authorizationFilters;
  }

  public static async addSiteAreasAuthorizations(tenant: Tenant, userToken: UserToken, siteAreas: SiteAreaDataResult): Promise<void> {
    // Get Site Admins
    const siteAdminIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
    // Add canCreate flag to root
    siteAreas.canCreate = await Authorizations.canCreateSite(userToken);
    // Enrich
    for (const siteArea of siteAreas.result) {
      await AuthorizationService.addSiteAreaAuthorizations(tenant, userToken, siteArea, siteAdminIDs);
    }
  }

  public static async addSiteAreaAuthorizations(tenant: Tenant, userToken: UserToken, siteArea: SiteArea, siteAdminIDs?: string[]): Promise<void> {
    // Get Site Admins
    if (Utils.isEmptyArray(siteAdminIDs)) {
      siteAdminIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
    }
    // Enrich
    if (!siteArea.issuer) {
      siteArea.canRead = true;
      siteArea.canUpdate = false;
      siteArea.canDelete = false;
    } else {
      const isSiteAdmin = siteAdminIDs.includes(siteArea.siteID) || (userToken.role === UserRole.ADMIN);
      siteArea.canRead = await Authorizations.canReadSiteArea(userToken);
      siteArea.canUpdate = await Authorizations.canUpdateSiteArea(userToken) && isSiteAdmin;
      siteArea.canDelete = await Authorizations.canDeleteSiteArea(userToken) && isSiteAdmin;
    }
  }

  public static async checkAndGetChargingStationAuthorizationFilters(tenant: Tenant, userToken: UserToken,
      filteredRequest: HttpChargingStationRequest):Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [
        'id', 'inactive', 'public', 'chargingStationURL', 'issuer', 'maximumPower', 'excludeFromSmartCharging', 'lastReboot',
        'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.smartCharging', 'siteArea.siteID',
        'siteArea.site.id', 'siteArea.site.name', 'siteID', 'voltage', 'coordinates', 'forceInactive', 'manualConfiguration', 'firmwareUpdateStatus',
        'capabilities', 'endpoint', 'chargePointVendor', 'chargePointModel', 'ocppVersion', 'ocppProtocol', 'lastSeen',
        'firmwareVersion', 'currentIPAddress', 'ocppStandardParameters', 'ocppVendorParameters', 'connectors', 'chargePoints',
        'createdOn', 'chargeBoxSerialNumber', 'chargePointSerialNumber', 'powerLimitUnit'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authorizationFilters.projectFields, filteredRequest.ProjectFields);
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      // Check assigned Sites
      await AuthorizationService.checkAssignedSites(
        tenant, userToken, null, authorizationFilters);
    }
    return authorizationFilters;
  }

  public static async getSiteAdminSiteIDs(tenantID: string, userToken: UserToken): Promise<string[]> {
    // Get the Sites where the user is Site Admin
    const userSites = await UserStorage.getUserSites(tenantID,
      {
        userID: userToken.id,
        siteAdmin: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    return userSites.result.map((userSite) => userSite.siteID);
  }

  private static async getSiteOwnerSiteIDs(tenantID: string, userToken: UserToken): Promise<string[]> {
    // Get the Sites where the user is Site Owner
    const userSites = await UserStorage.getUserSites(tenantID,
      {
        userID: userToken.id,
        siteOwner: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['siteID']
    );
    return userSites.result.map((userSite) => userSite.siteID);
  }

  private static async getAssignedSiteIDs(tenantID: string, userToken: UserToken): Promise<string[]> {
    // Get the Sites assigned to the User
    const sites = await SiteStorage.getSites(tenantID,
      {
        userID: userToken.id,
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    return sites.result.map((site) => site.id);
  }

  private static async getAssignedAssetIDs(tenantID: string, siteID: string): Promise<string[]> {
    // Get the Assets assigned to the Site
    const assets = await AssetStorage.getAssets(tenantID,
      {
        siteIDs: [siteID],
        // TODO: Uncomment when the bug will be fixed: https://github.com/sap-labs-france/ev-dashboard/issues/2266
        // issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    return assets.result.map((asset) => asset.id);
  }

  private static async getAssignedChargingStationIDs(tenantID: string, siteID: string): Promise<string[]> {
    // Get the Charging Stations assigned to the Site
    const chargingStations = await ChargingStationStorage.getChargingStations(tenantID,
      {
        siteIDs: [siteID],
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    return chargingStations.result.map(
      (chargingStation) => chargingStation.id);
  }

  private static async checkAssignedSites(tenant: Tenant, userToken: UserToken,
      filteredRequest: { SiteID?: string }, authorizationFilters: AuthorizationFilter): Promise<void> {
    if (userToken.role !== UserRole.ADMIN && userToken.role !== UserRole.SUPER_ADMIN) {
      if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
        // Get assigned Site IDs assigned to user from DB
        const siteIDs = await AuthorizationService.getAssignedSiteIDs(tenant.id, userToken);
        if (!Utils.isEmptyArray(siteIDs)) {
          // Force the filter
          authorizationFilters.filters.siteIDs = siteIDs;
          // Check if filter is provided
          if (filteredRequest?.SiteID) {
            const filteredSiteIDs = filteredRequest.SiteID.split('|');
            // Override
            authorizationFilters.filters.siteIDs = filteredSiteIDs.filter(
              (siteID) => authorizationFilters.filters.siteIDs.includes(siteID));
          }
        }
        if (!Utils.isEmptyArray(authorizationFilters.filters.siteIDs)) {
          authorizationFilters.authorized = true;
        }
      } else {
        authorizationFilters.authorized = true;
      }
    }
  }

  private static async checkAssignedSiteAdminsAndOwners(tenant: Tenant, userToken: UserToken,
      filteredRequest: { SiteID?: string }, authorizationFilters: AuthorizationFilter): Promise<void> {
    if (userToken.role !== UserRole.ADMIN && userToken.role !== UserRole.SUPER_ADMIN) {
      if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
        // Get Site IDs from Site Admin & Site Owner flag
        const siteAdminSiteIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
        const siteOwnerSiteIDs = await AuthorizationService.getSiteOwnerSiteIDs(tenant.id, userToken);
        const allSites = _.uniq([...siteAdminSiteIDs, ...siteOwnerSiteIDs]);
        if (!Utils.isEmptyArray(allSites)) {
          // Force the filterß
          authorizationFilters.filters.siteIDs = allSites;
          // Check if filter is provided
          if (filteredRequest?.SiteID) {
            const filteredSiteIDs: string[] = filteredRequest.SiteID.split('|');
            // Override
            authorizationFilters.filters.siteIDs = filteredSiteIDs.filter(
              (filteredSiteID) => authorizationFilters.filters.siteIDs.includes(filteredSiteID));
          }
        }
        if (!Utils.isEmptyArray(authorizationFilters.filters.siteIDs)) {
          authorizationFilters.authorized = true;
        }
      } else {
        authorizationFilters.authorized = true;
      }
    }
  }

  private static async getAssignedSiteAreaIDs(tenantID: string, userToken: UserToken, siteID?: string) {
    // Get the SiteArea IDs from sites assigned to the user
    const siteAreas = await SiteAreaStorage.getSiteAreas(tenantID,
      {
        siteIDs: Authorizations.getAuthorizedSiteIDs(userToken, siteID ? [siteID] : null),
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    return _.uniq(_.map(siteAreas.result, 'id'));
  }

  private static filterProjectFields(authFields: string[], httpProjectField: string): string[] {
    let fields = authFields;
    const httpProjectFields = UtilsService.httpFilterProjectToArray(httpProjectField);
    if (!Utils.isEmptyArray(httpProjectFields)) {
      fields = authFields.filter(
        (authField) => httpProjectFields.includes(authField));
    }
    return fields;
  }

  private static async processDynamicFilters(tenant: Tenant, userToken: UserToken, action: Action, entity: Entity,
      authorizationFilters: AuthorizationFilter, authorizationContext: AuthorizationContext, extraFilters?: Record<string, any>): Promise<void> {
    if (!Utils.isEmptyArray(authorizationContext.filters)) {
      for (const filter of authorizationContext.filters) {
        // Reset to false
        authorizationFilters.authorized = false;
        // Get the filter
        const dynamicFilter = await DynamicAuthorizationFactory.getDynamicFilter(tenant, userToken, filter, authorizationFilters.dataSources);
        if (!dynamicFilter) {
          // Filter not found -> Not authorized (all auth filter MUST work)
          throw new AppAuthError({
            errorCode: HTTPAuthError.FORBIDDEN,
            user: userToken,
            action, entity,
            module: MODULE_NAME, method: 'processDynamicFilters'
          });
        }
        // Process the filter
        dynamicFilter.processFilter(authorizationFilters, extraFilters);
        // Check
        if (!authorizationFilters.authorized) {
          break;
        }
      }
    }
  }

  private static async canPerformAuthorizationAction(tenant: Tenant, userToken: UserToken,
      entity: Entity, action: Action, authorizationFilters: AuthorizationFilter, filteredRequest?: Record<string, any>): Promise<boolean> {
    // Check static auth
    const authorizationContext: AuthorizationContext = {};
    const authResult = await Authorizations.can(userToken, entity, action, authorizationContext);
    authorizationFilters.authorized = authResult.authorized;
    if (!authorizationFilters.authorized) {
      return false;
    }
    // Check Dynamic Auth
    await AuthorizationService.processDynamicFilters(tenant, userToken, action, entity,
      authorizationFilters, authorizationContext, filteredRequest);
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authResult.fields, filteredRequest?.ProjectFields);
    return authorizationFilters.authorized;
  }
}
