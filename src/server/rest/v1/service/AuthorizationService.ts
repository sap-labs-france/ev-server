import { Action, AuthorizationFilter, Entity } from '../../../../types/Authorization';
import { HttpSiteAssignUsersRequest, HttpSiteUsersRequest } from '../../../../types/requests/HttpSiteRequest';
import User, { UserRole } from '../../../../types/User';

import AppAuthError from '../../../../exception/AppAuthError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import { HttpUsersRequest } from '../../../../types/requests/HttpUserRequest';
import { ServerAction } from '../../../../types/Server';
import Site from '../../../../types/Site';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import Tenant from '../../../../types/Tenant';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';

const MODULE_NAME = 'AuthorizationService';

export default class AuthorizationService {
  public static async checkAndGetSiteAuthorizationFilters(siteID: string,
      userToken: UserToken, tenant: Tenant): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      project: [
        'id', 'name', 'issuer', 'image', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'public'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check auth
    if (!Authorizations.canReadSite(userToken)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: userToken,
        action: Action.READ, entity: Entity.SITE,
        module: MODULE_NAME, method: 'checkAndGetSiteAuthorizationFilters',
      });
    }
    if (userToken.role !== UserRole.ADMIN) {
      // Get Site IDs from Site Admin flag
      const siteIDs = await AuthorizationService.getAssignedSiteIDs(tenant.id, userToken, siteID);
      if (Utils.isEmptyArray(siteIDs)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: userToken,
          action: Action.READ, entity: Entity.SITE,
          module: MODULE_NAME, method: 'checkAndGetSiteAuthorizationFilters',
        });
      }
    }
    return authorizationFilters;
  }
  
  public static async addSitesAuthorizations(userToken: UserToken, sites: Site[]) {
    // Enrich
    for (const site of sites) {
      site.canRead = Authorizations.canReadSite(userToken);
      site.canUpdate = Authorizations.canUpdateSite(userToken, site.id);
      site.canDelete = Authorizations.canDeleteSite(userToken, site.id);
    }
  }

  public static async checkAndGetSitesAuthorizationFilters(filteredRequest: HttpSiteUsersRequest,
      userToken: UserToken, tenant: Tenant): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      project: [
        'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
        'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check auth
    if (!Authorizations.canListSites(userToken)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: userToken,
        action: Action.LIST, entity: Entity.SITES,
        module: MODULE_NAME, method: 'checkAndGetSitesAuthorizationFilters'
      });
    }
    // Add user info
    if (Authorizations.canListUsers(userToken)) {
      authorizationFilters.project.push(
        'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName');
    }
    if (userToken.role !== UserRole.ADMIN) {
      // Get Site IDs from Site Admin flag
      const siteIDs = await AuthorizationService.getAssignedSiteIDs(tenant.id, userToken);
      if (!Utils.isEmptyArray(siteIDs)) {
        // Force the filter
        authorizationFilters.filters.siteIDs = siteIDs;
        // Check if filter is provided
        if (filteredRequest.SiteID) {
          const siteIDs = filteredRequest.SiteID.split('|');
          // Override
          authorizationFilters.filters.siteIDs = siteIDs.filter(
            (siteID) => authorizationFilters.filters.siteIDs.includes(siteID));
        }
      }
      if (!Utils.isEmptyArray(authorizationFilters.filters.siteIDs)) {
        authorizationFilters.authorized = true;
      }
    }
    return authorizationFilters;
  }

  public static async checkAndGetSiteUsersAuthorizationFilters(filteredRequest: HttpSiteUsersRequest,
      userToken: UserToken, tenant: Tenant): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      project: [
        'user.id', 'user.name', 'user.firstName', 'user.email', 'user.role', 'siteAdmin', 'siteOwner', 'siteID'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check auth
    if (!Authorizations.canListUsersSites(userToken)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: userToken,
        action: Action.LIST, entity: Entity.USERS_SITES,
        module: MODULE_NAME, method: 'checkAndGetSiteUsersAuthorizationFilters'
      });
    }
    if (userToken.role !== UserRole.ADMIN) {
      // Get Site IDs from Site Admin flag
      const siteIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
      if (!Utils.isEmptyArray(siteIDs)) {
        // Force the filter
        authorizationFilters.filters.siteIDs = siteIDs;
        // Check if filter is provided
        if (filteredRequest.SiteID) {
          const siteIDs = filteredRequest.SiteID.split('|');
          // Override
          authorizationFilters.filters.siteIDs = siteIDs.filter(
            (siteID) => authorizationFilters.filters.siteIDs.includes(siteID));
        }
      }
      if (!Utils.isEmptyArray(authorizationFilters.filters.siteIDs)) {
        authorizationFilters.authorized = true;
      }
    }
    return authorizationFilters;
  }

  public static async checkAndAssignSiteUsersAuthorizationFilters(action: ServerAction,
    filteredRequest: HttpSiteAssignUsersRequest, userToken: UserToken, tenant: Tenant): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      project: [
        'user.id', 'user.name', 'user.firstName', 'user.email', 'user.role', 'siteAdmin', 'siteOwner', 'siteID'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check auth
    console.log('🚀 -------------------');
    console.log('🚀 ~ action', action);
    console.log('🚀 -------------------');
    if (action === ServerAction.ADD_USERS_TO_SITE) {
      if (!Authorizations.canAssignUsersSites(userToken)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: userToken,
          action: Action.ASSIGN, entity: Entity.USERS_SITES,
          module: MODULE_NAME, method: 'checkAndAssignSiteUsersAuthorizationFilters'
        });
      }
    } else {
      if (!Authorizations.canUnassignUsersSites(userToken)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: userToken,
          action: Action.UNASSIGN, entity: Entity.USERS_SITES,
          module: MODULE_NAME, method: 'checkAndAssignSiteUsersAuthorizationFilters'
        });
      }
    }
    if (userToken.role !== UserRole.ADMIN) {
      // Get Site IDs from Site Admin flag
      const siteIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
      // Get User IDs from Site Admin flag
      if (!Utils.isEmptyArray(siteIDs)) {
        // Check Site ID
        if (siteIDs.includes(filteredRequest.siteID)) {
          // Site Authorized, now check users
          if (!Utils.isEmptyArray(filteredRequest.userIDs)) {
            let foundInvalidUserID = false;
            // Get authorized User IDs
            const userIDs = await AuthorizationService.getAssignedUsersIDs(tenant.id, filteredRequest.siteID);
            // Check
            for (const userID of filteredRequest.userIDs) {
              if (!userIDs.includes(userID)) {
                foundInvalidUserID = true;
                break;
              }
            }
            if (!foundInvalidUserID) {
              authorizationFilters.authorized = true;
            }
          }
        }
      }
      if (!authorizationFilters.authorized) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: userToken,
          action: action === ServerAction.ADD_USERS_TO_SITE ? Action.ASSIGN : Action.UNASSIGN,
          entity: Entity.USERS_SITES,
          module: MODULE_NAME, method: 'checkAndAssignSiteUsersAuthorizationFilters'
        });
      }
    }
    return authorizationFilters;
  }

  public static async checkAndGetUsersInErrorAuthorizationFilters(filteredRequest: HttpUsersRequest, userToken: UserToken, tenant: Tenant): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      project: [
        'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer',
        'createdOn', 'lastChangedOn', 'errorCodeDetails', 'errorCode'
      ]
    };
    // Get from users
    authorizationFilters.filters = await AuthorizationService.checkAndGetUsersAuthorizationFilters(filteredRequest, userToken, tenant);
    return authorizationFilters;
  }

  public static async addUsersAuthorizations(userToken: UserToken, users: User[]) {
    // Enrich
    for (const user of users) {
      user.canRead = Authorizations.canReadUser(userToken, user.id) 
      user.canUpdate = Authorizations.canUpdateUser(userToken, user.id) 
      user.canDelete = Authorizations.canDeleteUser(userToken, user.id) 
    }
  }

  public static async checkAndGetUsersAuthorizationFilters(filteredRequest: HttpUsersRequest, userToken: UserToken, tenant: Tenant): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      project: [
        'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'createdOn', 'createdBy',
        'lastChangedOn', 'lastChangedBy', 'eulaAcceptedOn', 'eulaAcceptedVersion', 'locale',
        'billingData.customerID', 'billingData.lastChangedOn'
      ]
    };
    // TODO: To replace with Authorization later on (quick fix for customer)
    if (userToken.role === UserRole.BASIC) {
      // Must be Site Admin as only Basic User with site admin role can access list of users
      const siteIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
      // Force the filter
      if (!Utils.isEmptyArray(siteIDs)) {
        authorizationFilters.filters.siteIDs = siteIDs;
      }
      // Check if filter is provided
      if (filteredRequest.SiteID) {
        const siteIDs = filteredRequest.SiteID.split('|');
        // Override
        authorizationFilters.filters.siteIDs = siteIDs.filter(
          (siteID) => authorizationFilters.filters.siteIDs.includes(siteID));
      }
    }
    return authorizationFilters;
  }

  public static async checkAndGetUserAuthorizationFilters(userToken: UserToken, tenant: Tenant): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      project:       [
        'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'deleted', 'plateID',
        'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address'
      ]
    };
    // TODO: To replace with Authorization later on (quick fix for customer)
    if (userToken.role === UserRole.BASIC) {
      // Must be Site Admin as only Basic User with site admin role can access list of users
      const siteIDs = await AuthorizationService.getSiteAdminSiteIDs(tenant.id, userToken);
      // Force the filter
      if (!Utils.isEmptyArray(siteIDs)) {
        authorizationFilters.filters.siteIDs = siteIDs;
      }
    }
    return authorizationFilters;
  }

  private static async getSiteAdminSiteIDs(tenantID: string, userToken: UserToken): Promise<string[]> {
    // Get the Sites where the user is Site Admin
    const userSites = await UserStorage.getUserSites(tenantID,
      {
        userID: userToken.id,
        siteAdmin: true
      }, Constants.DB_PARAMS_MAX_LIMIT,
      [ 'siteID' ]
    );
    return userSites.result.map((userSite) => userSite.siteID);
  }

  private static async getAssignedSiteIDs(tenantID: string, userToken: UserToken, siteID?: string): Promise<string[]> {
    // Get the Sites where the user is Site Admin
    const sites = await SiteStorage.getSites(tenantID,
      {
        siteIDs: siteID ? [ siteID ] : null,
        userID: userToken.id,
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      [ 'id' ]
    );
    return sites.result.map((site) => site.id);
  }

  private static async getAssignedUsersIDs(tenantID: string, siteID: string): Promise<string[]> {
    // Get the Sites where the user is Site Admin
    const users = await UserStorage.getUsers(tenantID,
      {
        siteIDs: [ siteID ],
        issuer: true,
      }, Constants.DB_PARAMS_MAX_LIMIT,
      [ 'id' ]
    );
    return users.result.map((user) => user.id);
  }
}
