import { Action, AuthorizationFilter, Entity } from '../../../../types/Authorization';
import { CompanyDataResult, SiteAreaDataResult, SiteDataResult } from '../../../../types/DataResult';
import { HttpCompaniesRequest, HttpCompanyRequest } from '../../../../types/requests/HttpCompanyRequest';
import { HttpSiteAreaRequest, HttpSiteAreasRequest } from '../../../../types/requests/HttpSiteAreaRequest';
import { HttpSiteAssignUsersRequest, HttpSiteRequest, HttpSiteUsersRequest } from '../../../../types/requests/HttpSiteRequest';
import { HttpTagsRequest, HttpUserAssignSitesRequest, HttpUserRequest, HttpUserSitesRequest, HttpUsersRequest } from '../../../../types/requests/HttpUserRequest';
import User, { UserRole } from '../../../../types/User';

import AppAuthError from '../../../../exception/AppAuthError';
import Authorizations from '../../../../authorization/Authorizations';
import Company from '../../../../types/Company';
import Constants from '../../../../utils/Constants';
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
import _ from 'lodash';

const MODULE_NAME = 'AuthorizationService';

export default class AuthorizationService {
  public static async checkAndGetSiteAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpSiteRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: [
        'id', 'name', 'issuer', 'image', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'public'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check Projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Not an Admin user?
    if (userToken.role !== UserRole.ADMIN) {
      // Check assigned Site
      await AuthorizationService.checkAssignedSites(
        tenant, userToken, { SiteID: filteredRequest.ID }, authorizationFilters);
    }
    return authorizationFilters;
  }

  public static async addSitesAuthorizations(tenant: Tenant, userToken: UserToken, sites: SiteDataResult): Promise<void> {
    // Get Site Admins
    const siteAdminIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
    // Add canCreate flag to root
    sites.canCreate = await Authorizations.canCreateSite(userToken);
    // Enrich
    for (const site of sites.result) {
      await AuthorizationService.addSiteAuthorizations(tenant, userToken, site, siteAdminIDs);
    }
  }

  public static async addSiteAuthorizations(tenant: Tenant, userToken: UserToken, site: Site, siteAdminIDs?: string[]): Promise<void> {
    // Get Site Admins
    if (Utils.isEmptyArray(siteAdminIDs)) {
      siteAdminIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
    }
    // Enrich
    if (!site.issuer) {
      site.canRead = true;
      site.canUpdate = false;
      site.canDelete = false;
    } else {
      const isSiteAdmin = siteAdminIDs.includes(site.id) || (userToken.role === UserRole.ADMIN);
      site.canRead = await Authorizations.canReadSite(userToken);
      site.canDelete = await Authorizations.canDeleteSite(userToken);
      site.canUpdate = await Authorizations.canUpdateSite(userToken) && isSiteAdmin;
    }
  }

  public static async checkAndGetSitesAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpSiteUsersRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: [
        'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
        'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Add user info
    if (await Authorizations.canListUsers(userToken)) {
      authorizationFilters.projectFields.push(
        'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName');
    }
    // Check Projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      // Check assigned Sites
      await AuthorizationService.checkAssignedSites(
        tenant, userToken, filteredRequest, authorizationFilters);
    }
    return authorizationFilters;
  }

  public static async checkAndGetSiteUsersAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpSiteUsersRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: [
        'user.id', 'user.name', 'user.firstName', 'user.email', 'user.role', 'siteAdmin', 'siteOwner', 'siteID'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdmins(
      tenant, userToken, filteredRequest, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAndGetUserSitesAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpUserSitesRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: [
        'site.id', 'site.name', 'site.address.city', 'site.address.country', 'siteAdmin', 'siteOwner', 'userID'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdmins(
      tenant, userToken, null, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAndAssignSiteUsersAuthorizationFilters(
      tenant: Tenant, action: ServerAction, userToken: UserToken, filteredRequest: HttpSiteAssignUsersRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: [],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      // Get Site IDs for which user is admin from db
      const siteAdminSiteIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
      // Check Site
      if (!Utils.isEmptyArray(siteAdminSiteIDs) && siteAdminSiteIDs.includes(filteredRequest.siteID)) {
        // Site Authorized, now check users
        if (!Utils.isEmptyArray(filteredRequest.userIDs)) {
          let foundInvalidUserID = false;
          // Get User IDs already assigned to the site
          const userIDs = await AuthorizationService.getAssignedUsersIDs(tenant.id, filteredRequest.siteID);
          // Check if any of the users we want to unassign are missing
          for (const userID of filteredRequest.userIDs) {
            if (!userIDs.includes(userID)) {
              foundInvalidUserID = true;
            }
          }
          if (!foundInvalidUserID) {
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
      projectFields: [
        'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer',
        'createdOn', 'lastChangedOn', 'errorCodeDetails', 'errorCode'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Get authorization filters from users
    const usersAuthorizationFilters = await AuthorizationService.checkAndGetUsersAuthorizationFilters(
      tenant, userToken, filteredRequest);
    // Override
    authorizationFilters.authorized = usersAuthorizationFilters.authorized;
    authorizationFilters.filters = usersAuthorizationFilters.filters;
    return authorizationFilters;
  }

  public static async addUsersAuthorizations(tenant: Tenant, userToken: UserToken, users: User[]): Promise<void> {
    // Enrich
    for (const user of users) {
      await AuthorizationService.addUserAuthorizations(tenant, userToken, user);
    }
  }

  public static async addUserAuthorizations(tenant: Tenant, userToken: UserToken, user: User): Promise<void> {
    // Enrich
    user.canRead = await Authorizations.canReadUser(userToken, user.id);
    user.canUpdate = await Authorizations.canUpdateUser(userToken, user.id);
    user.canDelete = await Authorizations.canDeleteUser(userToken, user.id);
  }

  public static async checkAndGetUsersAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpUsersRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: [
        'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'createdOn', 'createdBy',
        'lastChangedOn', 'lastChangedBy', 'eulaAcceptedOn', 'eulaAcceptedVersion', 'locale',
        'billingData.customerID', 'billingData.lastChangedOn'
      ],
      authorized: userToken.role === UserRole.ADMIN || userToken.role === UserRole.SUPER_ADMIN,
    };
    // Check projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdmins(
      tenant, userToken, filteredRequest, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAndGetAssetsAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpAssetsRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: [
        'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
        'dynamicAsset', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Handle Sites
    await AuthorizationService.checkAssignedSites(
      tenant, userToken, filteredRequest, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAndGetUserAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpUserRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: [
        'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'deleted', 'plateID',
        'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address'
      ],
      authorized: userToken.role === UserRole.ADMIN || userToken.role === UserRole.SUPER_ADMIN,
    };
    // Check projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdmins(
      tenant, userToken, null, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAndGetTagsAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpTagsRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
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
    // Check projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdmins(
      tenant, userToken, null, authorizationFilters);
    return authorizationFilters;
  }

  public static async checkAndGetTagAuthorizationFilters(
      tenant: Tenant, userToken: UserToken, filteredRequest: HttpByIDRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: ['id', 'userID', 'issuer', 'active', 'description', 'default', 'deleted', 'user.id', 'user.name', 'user.firstName', 'user.email'],
      authorized: userToken.role === UserRole.ADMIN || userToken.role === UserRole.SUPER_ADMIN,
    };
    // Check projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdmins(
      tenant, userToken, null, authorizationFilters);
    return authorizationFilters;
  }

  public static async addCompaniesAuthorizations(tenant: Tenant, userToken: UserToken, companies: CompanyDataResult): Promise<void> {
    // Get Site Admins
    const { siteAdminIDs, siteOwnerIDs } = await AuthorizationService.getSiteAdminOwnerIDs(tenant, userToken);
    // Set to user
    userToken.sitesAdmin = siteAdminIDs;
    userToken.sitesOwner = siteOwnerIDs;
    // Add canCreate flag to root
    companies.canCreate = await Authorizations.canCreateCompany(userToken);
    // Enrich
    for (const company of companies.result) {
      await AuthorizationService.addCompanyAuthorizations(tenant, userToken, company);
    }
  }

  public static async addCompanyAuthorizations(tenant: Tenant, userToken: UserToken, company: Company): Promise<void> {
    // Enrich
    if (!company.issuer) {
      company.canRead = true;
      company.canUpdate = false;
      company.canDelete = false;
    } else {
      company.canRead = (await Authorizations.canReadCompany(userToken)).authorized;
      company.canDelete = await Authorizations.canDeleteCompany(userToken);
      company.canUpdate = await Authorizations.canUpdateCompany(userToken);
    }
  }

  public static async checkAndGetCompaniesAuthorizationFilters(tenant: Tenant, userToken: UserToken,
      filteredRequest: HttpCompaniesRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: [],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check static auth
    const authResult = await Authorizations.canListCompanies(userToken);
    if (!authResult.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: userToken,
        action: Action.LIST, entity: Entity.COMPANIES,
        module: MODULE_NAME, method: 'checkAndGetCompaniesAuthorizationFilters'
      });
    }
    authorizationFilters.projectFields = authResult.fields;
    // Check Projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
        // Get Company IDs from Site Admin flag
        const companyIDs = await AuthorizationService.getAssignedSitesCompanyIDs(tenant.id, userToken);
        if (!Utils.isEmptyArray(companyIDs)) {
          // Force the filter
          authorizationFilters.filters.companyIDs = companyIDs;
          // Check if filter is provided
          if (Utils.objectHasProperty(filteredRequest, 'CompanyID') &&
              !Utils.isNullOrUndefined(filteredRequest['CompanyID'])) {
            const filteredCompanyIDs: string[] = filteredRequest['CompanyID'].split('|');
            // Override
            authorizationFilters.filters.companyIDs = filteredCompanyIDs.filter(
              (companyID) => authorizationFilters.filters.companyIDs.includes(companyID));
          }
        }
        if (!Utils.isEmptyArray(authorizationFilters.filters.companyIDs)) {
          authorizationFilters.authorized = true;
        }
      } else {
        authorizationFilters.authorized = true;
      }
    }
    return authorizationFilters;
  }

  public static async checkAndGetCompanyAuthorizationFilters(tenant: Tenant, userToken: UserToken,
      filteredRequest: HttpCompanyRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: [],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check static auth
    const authResult = await Authorizations.canReadCompany(userToken);
    if (!authResult.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: userToken,
        action: Action.READ, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'checkAndGetCompanyAuthorizationFilters',
      });
    }
    authorizationFilters.projectFields = authResult.fields;
    // Check projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      // Get Company IDs from sssigned Sites
      const companyIDs = await AuthorizationService.getAssignedSitesCompanyIDs(tenant.id, userToken);
      if (!Utils.isEmptyArray(companyIDs) && companyIDs.includes(filteredRequest.ID)) {
        authorizationFilters.authorized = true;
      }
    }
    return authorizationFilters;
  }

  public static async checkAndGetSiteAreaAuthorizationFilters(tenant: Tenant, userToken: UserToken, filteredRequest: HttpSiteAreaRequest): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      projectFields: [
        'id', 'name', 'issuer', 'image', 'address', 'maximumPower', 'numberOfPhases',
        'voltage', 'smartCharging', 'accessControl', 'connectorStats', 'siteID', 'site.name'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
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
      projectFields: [
        'id', 'name', 'siteID', 'maximumPower', 'voltage', 'numberOfPhases', 'accessControl', 'smartCharging', 'address',
        'site.id', 'site.name', 'issuer', 'distanceMeters', 'createdOn', 'createdBy', 'lastChangedOn', 'lastChangedBy'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check Projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
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
    // Check Projection
    if (!Utils.isEmptyArray(filteredRequest.ProjectFields)) {
      authorizationFilters.projectFields = authorizationFilters.projectFields.filter(
        (projectField) => filteredRequest.ProjectFields.includes(projectField));
    }
    // Not an Admin?
    if (userToken.role !== UserRole.ADMIN) {
      // Check assigned Sites
      await AuthorizationService.checkAssignedSites(
        tenant, userToken, null, authorizationFilters);
    }
    return authorizationFilters;
  }

  public static async getAssignedSitesCompanyIDs(tenantID: string, userToken: UserToken, siteID?: string): Promise<string[]> {
    // Get the Company IDs of the assigned Sites
    const sites = await SiteStorage.getSites(tenantID,
      {
        siteIDs: siteID ? [siteID] : null,
        userID: userToken.id,
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['companyID']
    );
    return _.uniq(_.map(sites.result, 'companyID'));
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
    // Get the Sites assigned to user
    const sites = await SiteStorage.getSites(tenantID,
      {
        userID: userToken.id,
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    return sites.result.map((site) => site.id);
  }

  private static async getAssignedUsersIDs(tenantID: string, siteID: string): Promise<string[]> {
    // Get the Users assigned to the site
    const users = await UserStorage.getUsers(tenantID,
      {
        siteIDs: [siteID],
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      ['id']
    );
    return users.result.map((user) => user.id);
  }

  private static async getSiteAdminOwnerIDs(tenant: Tenant, userToken: UserToken): Promise<{ siteAdminIDs: string[]; siteOwnerIDs: string[]; }> {
    const siteAdminIDs: string[] = [];
    const siteOwnerIDs: string[] = [];
    const userSites = await UserStorage.getUserSites(tenant.id, { userID: userToken.id }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const userSite of userSites.result) {
      if (userSite.siteAdmin) {
        siteAdminIDs.push(userSite.siteID);
      }
      if (userSite.siteOwner) {
        siteOwnerIDs.push(userSite.siteID);
      }
    }
    return {
      siteAdminIDs,
      siteOwnerIDs
    };
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

  private static async checkAssignedSiteAdmins(tenant: Tenant, userToken: UserToken,
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

  private static async getSiteAreaSiteID(tenantID: string, siteAreaID: string) {
    // Get the Site IDs of SiteArea
    const siteArea = await SiteAreaStorage.getSiteArea(tenantID, siteAreaID);
    return siteArea.siteID;
  }
}
