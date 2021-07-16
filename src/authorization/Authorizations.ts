import { Action, AuthorizationContext, AuthorizationResult, Entity } from '../types/Authorization';
import User, { UserRole, UserStatus } from '../types/User';

import AuthorizationConfiguration from '../types/configuration/AuthorizationConfiguration';
import AuthorizationsDefinition from './AuthorizationsDefinition';
import BackendError from '../exception/BackendError';
import ChargingStation from '../types/ChargingStation';
import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import CpoOCPIClient from '../client/ocpi/CpoOCPIClient';
import CpoOICPClient from '../client/oicp/CpoOICPClient';
import Logging from '../utils/Logging';
import NotificationHandler from '../notification/NotificationHandler';
import OCPIClientFactory from '../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../types/ocpi/OCPIRole';
import OCPIUtils from '../server/ocpi/OCPIUtils';
import { OICPAuthorizationStatus } from '../types/oicp/OICPAuthentication';
import OICPClientFactory from '../client/oicp/OICPClientFactory';
import { OICPDefaultTagId } from '../types/oicp/OICPIdentification';
import { OICPRole } from '../types/oicp/OICPRole';
import { PricingSettingsType } from '../types/Setting';
import { ServerAction } from '../types/Server';
import SessionHashService from '../server/rest/v1/service/SessionHashService';
import SettingStorage from '../storage/mongodb/SettingStorage';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../storage/mongodb/SiteStorage';
import Tag from '../types/Tag';
import TagStorage from '../storage/mongodb/TagStorage';
import Tenant from '../types/Tenant';
import TenantComponents from '../types/TenantComponents';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Transaction from '../types/Transaction';
import UserStorage from '../storage/mongodb/UserStorage';
import UserToken from '../types/UserToken';
import Utils from '../utils/Utils';

const MODULE_NAME = 'Authorizations';

export default class Authorizations {

  private static configuration: AuthorizationConfiguration;

  public static async canRefundTransaction(loggedUser: UserToken, transaction: Transaction): Promise<boolean> {
    const context: AuthorizationContext = {
      UserID: transaction.userID,
      sitesOwner: loggedUser.sitesOwner,
      site: transaction.siteID
    };
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION,
      Action.REFUND_TRANSACTION, context);
  }

  public static async canStartTransaction(loggedUser: UserToken, chargingStation: ChargingStation): Promise<boolean> {
    let context: AuthorizationContext;
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.ORGANIZATION)) {
      if (!chargingStation || !chargingStation.siteArea || !chargingStation.site) {
        return false;
      }
      context = {
        site: chargingStation.site.id,
        sites: loggedUser.sites,
        sitesAdmin: loggedUser.sitesAdmin
      };
    } else {
      context = {
        site: null
      };
    }
    return Authorizations.canPerformAction(
      loggedUser, Entity.CHARGING_STATION,
      Action.REMOTE_START_TRANSACTION, context);
  }

  public static async canStopTransaction(loggedUser: UserToken, transaction: Transaction): Promise<boolean> {
    if (!transaction) {
      return false;
    }
    const context: AuthorizationContext = {
      user: transaction.userID,
      owner: loggedUser.id,
      tagIDs: loggedUser.tagIDs,
      tagID: transaction.tagID,
      site: transaction.siteID,
      sites: loggedUser.sites,
      sitesAdmin: loggedUser.sitesAdmin
    };
    return Authorizations.canPerformAction(
      loggedUser, Entity.CHARGING_STATION, Action.REMOTE_STOP_TRANSACTION, context);
  }

  public static getAuthorizedSiteIDs(loggedUser: UserToken, requestedSites: string[]): string[] {
    if (!Utils.isComponentActiveFromToken(loggedUser, TenantComponents.ORGANIZATION)) {
      return null;
    }
    if (this.isAdmin(loggedUser)) {
      return requestedSites;
    }
    if (Utils.isEmptyArray(requestedSites)) {
      return loggedUser.sites.length > 0 ? loggedUser.sites : null;
    }
    return requestedSites.filter((site) => loggedUser.sites.includes(site));
  }

  public static getAuthorizedSiteAdminIDs(loggedUser: UserToken, requestedSites?: string[]): string[] {
    if (!Utils.isComponentActiveFromToken(loggedUser, TenantComponents.ORGANIZATION)) {
      return null;
    }
    if (this.isDemo(loggedUser)) {
      return null;
    }
    if (this.isAdmin(loggedUser)) {
      return requestedSites;
    }
    const sites: Set<string> = new Set(loggedUser.sitesAdmin);
    for (const siteID of loggedUser.sitesOwner) {
      sites.add(siteID);
    }
    if (Utils.isEmptyArray(requestedSites)) {
      return [...sites];
    }
    return requestedSites.filter((site) => sites.has(site));
  }

  public static async buildUserToken(tenantID: string, user: User, tags: Tag[]): Promise<UserToken> {
    const siteIDs = [];
    const siteAdminIDs = [];
    const siteOwnerIDs = [];
    // Get User's site
    const sites = (await UserStorage.getUserSites(tenantID, { userIDs: [user.id] },
      Constants.DB_PARAMS_MAX_LIMIT)).result;
    for (const siteUser of sites) {
      if (!Authorizations.isAdmin(user)) {
        siteIDs.push(siteUser.site.id);
        if (siteUser.siteAdmin) {
          siteAdminIDs.push(siteUser.site.id);
        }
      }
      if (siteUser.siteOwner) {
        siteOwnerIDs.push(siteUser.site.id);
      }
    }
    let tenantHashID = Constants.DEFAULT_TENANT;
    let activeComponents = [];
    let tenantName;
    let tenantSubdomain;
    if (tenantID !== Constants.DEFAULT_TENANT) {
      const tenant = await TenantStorage.getTenant(tenantID);
      tenantName = tenant.name;
      tenantSubdomain = tenant.subdomain;
      tenantHashID = SessionHashService.buildTenantHashID(tenant);
      activeComponents = Utils.getTenantActiveComponents(tenant);
    }
    // Currency
    let currency = null;
    const pricing = await SettingStorage.getPricingSettings(tenantID);
    if (pricing && pricing.type === PricingSettingsType.SIMPLE) {
      currency = pricing.simple.currency;
    }
    const authDefinition = AuthorizationsDefinition.getInstance();
    const rolesACL = Authorizations.getAuthGroupsFromUser(user.role, siteAdminIDs.length, siteOwnerIDs.length);
    return {
      id: user.id,
      role: user.role,
      rolesACL,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      tagIDs: tags ? tags.filter((tag) => tag.active).map((tag) => tag.id) : [],
      firstName: user.firstName,
      locale: user.locale,
      language: Utils.getLanguageFromLocale(user.locale),
      currency: currency,
      tenantID: tenantID,
      tenantName: tenantName,
      tenantSubdomain: tenantSubdomain,
      userHashID: SessionHashService.buildUserHashID(user),
      tenantHashID: tenantHashID,
      scopes: await authDefinition.getScopes(rolesACL),
      sitesAdmin: siteAdminIDs,
      sitesOwner: siteOwnerIDs,
      sites: siteIDs,
      activeComponents: activeComponents
    };
  }

  public static async isAuthorizedOnChargingStation(tenant: Tenant, chargingStation: ChargingStation,
      tagID: string, action: ServerAction, authAction: Action): Promise<User> {
    return await Authorizations.isTagIDAuthorizedOnChargingStation(tenant, chargingStation, null, tagID, action, authAction);
  }

  public static async isAuthorizedToStartTransaction(tenant: Tenant, chargingStation: ChargingStation,
      tagID: string, action: ServerAction, authAction?: Action): Promise<User> {
    return await Authorizations.isTagIDAuthorizedOnChargingStation(tenant, chargingStation, null, tagID, action, authAction);
  }

  public static async isAuthorizedToStopTransaction(tenant: Tenant, chargingStation: ChargingStation,
      transaction: Transaction, tagID: string, action: ServerAction, authAction?: Action): Promise<{ user: User; alternateUser: User }> {
    let user: User, alternateUser: User;
    // Check if same user
    if (tagID !== transaction.tagID) {
      alternateUser = await Authorizations.isTagIDAuthorizedOnChargingStation(
        tenant, chargingStation, transaction, tagID, action, authAction);
      user = await UserStorage.getUserByTagId(tenant.id, transaction.tagID);
    } else {
      // Check user
      user = await Authorizations.isTagIDAuthorizedOnChargingStation(
        tenant, chargingStation, transaction, transaction.tagID, action, authAction);
    }
    return { user, alternateUser };
  }

  public static async canListLoggings(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.LOGGINGS, Action.LIST);
  }

  public static async canReadLog(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.LOGGING, Action.READ);
  }

  public static async canListTransactions(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTIONS, Action.LIST);
  }

  public static async canListTransactionsInError(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTIONS, Action.IN_ERROR);
  }

  public static async canReadTransaction(loggedUser: UserToken, transaction: Transaction): Promise<boolean> {
    if (!transaction) {
      return false;
    }
    const context: AuthorizationContext = {
      user: transaction.userID,
      owner: loggedUser.id,
      tagIDs: loggedUser.tagIDs,
      tagID: transaction.tagID,
      site: transaction.siteID,
      sites: loggedUser.sites,
      sitesAdmin: loggedUser.sitesAdmin,
      sitesOwner: loggedUser.sitesOwner
    };
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION, Action.READ, context);
  }

  public static async canReadReport(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.REPORT, Action.READ);
  }

  public static async canUpdateTransaction(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION, Action.UPDATE);
  }

  public static async canDeleteTransaction(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION, Action.DELETE);
  }

  public static async canListChargingStations(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATIONS, Action.LIST);
  }

  public static async canListChargingStationsInError(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATIONS, Action.IN_ERROR);
  }

  public static async canPerformActionOnChargingStation(loggedUser: UserToken, action: Action, chargingStation: ChargingStation, context?: AuthorizationContext): Promise<boolean> {
    if (!context) {
      const isOrgCompActive = Utils.isComponentActiveFromToken(loggedUser, TenantComponents.ORGANIZATION);
      context = {
        tagIDs: loggedUser.tagIDs,
        owner: loggedUser.id,
        site: isOrgCompActive ? chargingStation.siteID : null,
        sites: loggedUser.sites,
        sitesAdmin: loggedUser.sitesAdmin
      };
    }
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, action, context);
  }

  public static async canReadChargingStation(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.READ);
  }

  public static async canUpdateChargingStation(loggedUser: UserToken, siteID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.UPDATE, {
      site: siteID,
      sitesAdmin: loggedUser.sitesAdmin
    });
  }

  public static async canDeleteChargingStation(loggedUser: UserToken, siteID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.DELETE, {
      site: siteID,
      sitesAdmin: loggedUser.sitesAdmin
    });
  }

  public static async canExportParams(loggedUser: UserToken, siteID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.EXPORT, {
      site: siteID,
      sitesAdmin: loggedUser.sitesAdmin
    });

  }

  public static async canAssignUsersSites(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USERS_SITES, Action.ASSIGN, authContext);
  }

  public static async canUnassignUsersSites(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USERS_SITES, Action.UNASSIGN, authContext);
  }

  public static async canListUsersSites(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USERS_SITES, Action.LIST, authContext);
  }

  public static async canListUsers(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USERS, Action.LIST, authContext);
  }

  public static async canListUsersInErrors(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USERS, Action.IN_ERROR, authContext);
  }

  public static async canListTags(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TAGS, Action.LIST);
  }

  public static async canReadTag(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TAG, Action.READ);
  }

  public static async canDeleteTag(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TAG, Action.DELETE);
  }

  public static async canCreateTag(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TAG, Action.CREATE);
  }

  public static async canUpdateTag(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TAG, Action.UPDATE);
  }

  public static async canImportTags(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.TAGS, Action.IMPORT, authContext);
  }

  public static async canExportTags(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.TAGS, Action.EXPORT, authContext);
  }

  public static async canReadUser(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.READ, authContext);
  }

  public static async canCreateUser(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.CREATE, authContext);
  }

  public static async canImportUsers(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USERS, Action.IMPORT, authContext);
  }

  public static async canUpdateUser(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.UPDATE, authContext);
  }

  public static async canDeleteUser(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.DELETE, authContext);
  }

  public static async canListSites(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.SITES, Action.LIST, authContext);
  }

  public static async canReadSite(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.SITE, Action.READ, authContext);
  }

  public static async canCreateSite(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.SITE, Action.CREATE, authContext);
  }

  public static async canUpdateSite(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.SITE, Action.UPDATE, authContext);
  }

  public static async canDeleteSite(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.SITE, Action.DELETE, authContext);
  }

  public static async canListSettings(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTINGS, Action.LIST);
  }

  public static async canReadSetting(loggedUser: UserToken, context?: AuthorizationContext): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTING, Action.READ, context);
  }

  public static async canDeleteSetting(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTING, Action.DELETE);
  }

  public static async canCreateSetting(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTING, Action.CREATE);
  }

  public static async canUpdateSetting(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTING, Action.UPDATE);
  }

  public static async canCreateRegistrationToken(loggedUser: UserToken, siteID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKEN, Action.CREATE, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static async canReadRegistrationToken(loggedUser: UserToken, siteID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKEN, Action.READ, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static async canDeleteRegistrationToken(loggedUser: UserToken, siteID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKEN, Action.DELETE, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static async canUpdateRegistrationToken(loggedUser: UserToken, siteID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKEN, Action.UPDATE, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static async canListRegistrationTokens(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKENS, Action.LIST);
  }

  public static async canListOcpiEndpoints(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINTS, Action.LIST);
  }

  public static async canReadOcpiEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.READ);
  }

  public static async canDeleteOcpiEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.DELETE);
  }

  public static async canCreateOcpiEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.CREATE);
  }

  public static async canUpdateOcpiEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.UPDATE);
  }

  public static async canPingOcpiEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.PING);
  }

  public static async canTriggerJobOcpiEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.TRIGGER_JOB);
  }

  public static async canRegisterOcpiEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.REGISTER);
  }

  public static async canGenerateLocalTokenOcpiEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.GENERATE_LOCAL_TOKEN);
  }

  public static async canListOicpEndpoints(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OICP_ENDPOINTS, Action.LIST);
  }

  public static async canReadOicpEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OICP_ENDPOINT, Action.READ);
  }

  public static async canDeleteOicpEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OICP_ENDPOINT, Action.DELETE);
  }

  public static async canCreateOicpEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OICP_ENDPOINT, Action.CREATE);
  }

  public static async canUpdateOicpEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OICP_ENDPOINT, Action.UPDATE);
  }

  public static async canPingOicpEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OICP_ENDPOINT, Action.PING);
  }

  public static async canTriggerJobOicpEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OICP_ENDPOINT, Action.TRIGGER_JOB);
  }

  public static async canRegisterOicpEndpoint(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OICP_ENDPOINT, Action.REGISTER);
  }

  public static async canListChargingProfiles(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_PROFILES, Action.LIST);
  }

  public static async canReadChargingProfile(loggedUser: UserToken, siteID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_PROFILE, Action.READ,{
      site: siteID,
      sitesAdmin: loggedUser.sitesAdmin
    });
  }

  public static async canUpdateSiteArea(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.SITE_AREA, Action.UPDATE, authContext);
  }

  public static async canListCarCatalogs(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CAR_CATALOGS, Action.LIST);
  }

  public static async canListCars(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CARS, Action.LIST);
  }

  public static async canSynchronizeCarCatalogs(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.CAR_CATALOG, Action.SYNCHRONIZE, authContext);
  }

  public static async canUpdateCar(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CAR, Action.UPDATE);
  }

  public static async canListAssets(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSETS, Action.LIST);
  }

  public static async canListAssetsInError(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSETS, Action.IN_ERROR);
  }

  public static async canReadAsset(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.READ);
  }

  public static async canCreateAsset(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.CREATE);
  }

  public static async canUpdateAsset(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.UPDATE);
  }

  public static async canDeleteAsset(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.DELETE);
  }

  public static async canListTenants(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TENANTS, Action.LIST);
  }

  public static async canReadTenant(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TENANT, Action.READ);
  }

  public static async canCreateTenant(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TENANT, Action.CREATE);
  }

  public static async canUpdateTenant(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TENANT, Action.UPDATE);
  }

  public static async canDeleteTenant(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TENANT, Action.DELETE);
  }

  public static async canCreateConnection(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CONNECTION, Action.CREATE);
  }

  public static async canDeleteConnection(loggedUser: UserToken, userID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CONNECTION, Action.DELETE,
      { user: userID, owner: loggedUser.id });
  }

  public static async canReadConnection(loggedUser: UserToken, userID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CONNECTION, Action.READ,
      { user: userID, owner: loggedUser.id });
  }

  public static async canListConnections(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CONNECTIONS, Action.LIST);
  }

  public static async canReadPricing(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.PRICING, Action.READ);
  }

  public static async canUpdatePricing(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.PRICING, Action.UPDATE);
  }

  public static async canClearBillingTestData(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.BILLING, Action.CLEAR_BILLING_TEST_DATA);
  }

  public static async canCheckBillingConnection(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.BILLING, Action.CHECK_CONNECTION);
  }

  public static async canSynchronizeUsersBilling(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USERS, Action.SYNCHRONIZE_BILLING_USERS, authContext);
  }

  public static async canSynchronizeUserBilling(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.SYNCHRONIZE_BILLING_USER, authContext);
  }

  public static async canReadTaxesBilling(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TAXES, Action.LIST);
  }

  public static async canListInvoicesBilling(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICES, Action.LIST);
  }

  public static async canReadInvoiceBilling(loggedUser: UserToken, userID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICE, Action.READ,
      { user: userID, owner: loggedUser.id });
  }

  public static async canSynchronizeInvoicesBilling(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICES, Action.SYNCHRONIZE);
  }

  public static async canCreateTransactionInvoice(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICE, Action.CREATE);
  }

  public static async canDownloadInvoiceBilling(loggedUser: UserToken, userID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICE, Action.DOWNLOAD,
      { user: userID, owner: loggedUser.id });
  }

  public static async canCheckAssetConnection(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.CHECK_CONNECTION);
  }

  public static async canRetrieveAssetConsumption(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.RETRIEVE_CONSUMPTION);
  }

  public static async canCreateAssetConsumption(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.CREATE_CONSUMPTION);
  }

  public static async canEndUserReportError(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.NOTIFICATION, Action.CREATE, authContext);
  }

  public static async canListPaymentMethod(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.NOTIFICATION, Action.CREATE);
  }

  // or canPerformAction(loggedUser, Entity.BILLING, Action.CREATE_PAYMENT_METHOD)
  public static async canCreatePaymentMethod(loggedUser: UserToken, userID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.PAYMENT_METHOD, Action.CREATE,
      { user: userID, owner: loggedUser.id }
    );
  }

  public static async canDeletePaymentMethod(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.PAYMENT_METHOD, Action.CREATE);
  }

  public static async canReadBillingSetting(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTING, Action.READ);
  }

  public static async canUpdateBillingSetting(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTING, Action.UPDATE);
  }

  public static isSuperAdmin(user: UserToken | User): boolean {
    return user.role === UserRole.SUPER_ADMIN;
  }

  public static isAdmin(user: UserToken | User): boolean {
    return user.role === UserRole.ADMIN;
  }

  public static isSiteAdmin(user: UserToken): boolean {
    return user.role === UserRole.BASIC && !Utils.isEmptyArray(user.sitesAdmin);
  }

  public static isSiteOwner(user: UserToken): boolean {
    return !Utils.isEmptyArray(user.sitesOwner);
  }

  public static isBasic(user: UserToken | User): boolean {
    return user.role === UserRole.BASIC;
  }

  public static isDemo(user: UserToken | User): boolean {
    return user.role === UserRole.DEMO;
  }

  public static async can(loggedUser: UserToken, entity: Entity, action: Action, context?: AuthorizationContext): Promise<AuthorizationResult> {
    // Check
    const authDefinition = AuthorizationsDefinition.getInstance();
    const result = await authDefinition.canPerformAction(loggedUser.rolesACL, entity, action, context);
    if (!result.authorized && Authorizations.getConfiguration().debug) {
      void Logging.logSecurityInfo({
        tenantID: loggedUser.tenantID, user: loggedUser,
        action: ServerAction.AUTHORIZATIONS,
        module: MODULE_NAME, method: 'canPerformAction',
        message: `Role ${loggedUser.role} Cannot ${action} on ${entity} with context ${JSON.stringify(context)}`,
      });
    }
    return result;
  }

  public static async isChargingStationValidInOrganization(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation): Promise<boolean> {
    // Org component enabled?
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
      let foundSiteArea = true;
      // Site Area -----------------------------------------------
      if (!chargingStation.siteAreaID) {
        foundSiteArea = false;
      } else if (!chargingStation.siteArea) {
        chargingStation.siteArea = await SiteAreaStorage.getSiteArea(
          tenant.id, chargingStation.siteAreaID, { withSite: true });
        if (!chargingStation.siteArea) {
          foundSiteArea = false;
        }
      }
      // Site is mandatory
      if (!foundSiteArea) {
        // Reject Site Not Found
        throw new BackendError({
          source: chargingStation.id,
          action: action,
          module: MODULE_NAME, method: 'isTagIDAuthorizedOnChargingStation',
          message: `Charging Station '${chargingStation.id}' is not assigned to a Site Area!`,
          detailedMessages: { chargingStation }
        });
      }
      // Site -----------------------------------------------------
      chargingStation.site = await SiteStorage.getSite(tenant, chargingStation.siteID);
      if (!chargingStation.site) {
        // Reject Site Not Found
        throw new BackendError({
          source: chargingStation.id,
          action: action,
          module: MODULE_NAME, method: 'isTagIDAuthorizedOnChargingStation',
          message: `Site Area '${chargingStation.siteArea.name}' is not assigned to a Site!`,
          detailedMessages: { chargingStation }
        });
      }
      return true;
    }
  }

  private static async isTagIDAuthorizedOnChargingStation(tenant: Tenant, chargingStation: ChargingStation,
      transaction: Transaction, tagID: string, action: ServerAction, authAction: Action): Promise<User> {
    // Check Organization
    if (await Authorizations.isChargingStationValidInOrganization(action, tenant, chargingStation)) {
      // Access Control is disabled?
      if (!chargingStation.siteArea.accessControl) {
        // No ACL: Always try to get the user
        return UserStorage.getUserByTagId(tenant.id, tagID);
      }
    }
    // Get Authorized Tag
    const tag = await this.checkAndGetAuthorizedTag(action, tenant, chargingStation, tagID);
    if (!tag) {
      // Check OICP first
      const user = await this.checkAndGetOICPAuthorizedUser(action, tenant, transaction, tagID);
      if (user) {
        return user;
      }
      // Create the Tag as inactive and abort
      await this.createInactiveTagAndAbortAction(action, tenant, tagID, chargingStation);
    }
    // Get Authorized User
    const user = await this.checkAndGetAuthorizedUserFromTag(action, tenant, chargingStation, transaction, tag, authAction);
    // Check OCPI
    if (user && !user.issuer) {
      await this.checkOCPIAuthorizedUser(action, tenant, chargingStation, transaction, tag, user, authAction);
    }
    return user;
  }

  private static async checkOCPIAuthorizedUser(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation,
      transaction: Transaction, tag: Tag, user: User, authAction: Action) {
    // OCPI Active?
    if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
      throw new BackendError({
        user: user, action,
        module: MODULE_NAME, method: 'checkOCPIAuthorizedUser',
        message: `Unable to authorize Tag ID '${tag.id}', Roaming is not active`,
        detailedMessages: { tag }
      });
    }
    // Got Token from OCPI
    if (!tag.ocpiToken) {
      throw new BackendError({
        user: user, action,
        module: MODULE_NAME, method: 'checkOCPIAuthorizedUser',
        message: `Tag ID '${tag.id}' cannot be authorized through OCPI protocol due to missing OCPI Token`,
        detailedMessages: { tag }
      });
    }
    // Check Charging Station
    if (!chargingStation.public) {
      throw new BackendError({
        user: user, action,
        module: MODULE_NAME, method: 'checkOCPIAuthorizedUser',
        message: `Tag ID '${tag.id}' cannot be authorized on a private Charging Station`,
        detailedMessages: { tag, chargingStation }
      });
    }
    // Request Authorization
    if (authAction === Action.AUTHORIZE) {
      const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
      if (!ocpiClient) {
        throw new BackendError({
          user: user, action,
          module: MODULE_NAME, method: 'checkOCPIAuthorizedUser',
          message: 'OCPI component requires at least one CPO endpoint to authorize users'
        });
      }
      // Transaction can be nullified to assess the authorization at a higher level than connectors, default connector ID value to 1 then
      const transactionConnector = transaction?.connectorId ?
        Utils.getConnectorFromID(chargingStation, transaction.connectorId) : Utils.getConnectorFromID(chargingStation, 1);
      // Check Remote Authorization on Charging Station
      if (!Utils.isEmptyArray(chargingStation.remoteAuthorizations)) {
        for (const remoteAuthorization of chargingStation.remoteAuthorizations) {
          // Check validity
          if (remoteAuthorization.tagId === tag.ocpiToken.uid &&
              OCPIUtils.isAuthorizationValid(remoteAuthorization.timestamp)) {
            await Logging.logDebug({
              source: chargingStation.id,
              tenantID: tenant.id, action,
              message: `Valid Remote Authorization found for Tag ID '${tag.ocpiToken.uid}'`,
              module: MODULE_NAME, method: 'checkOCPIAuthorizedUser',
              detailedMessages: { response: remoteAuthorization }
            });
            user.authorizationID = remoteAuthorization.id;
            break;
          }
        }
        // Clean up the remote auth
        if (!user.authorizationID) {
          chargingStation.remoteAuthorizations = [];
          await ChargingStationStorage.saveChargingStationRemoteAuthorizations(
            tenant.id, chargingStation.id, chargingStation.remoteAuthorizations);
        }
      }
      // Retrieve Auth token from OCPI
      user.authorizationID = await ocpiClient.authorizeToken(
        tag.ocpiToken, chargingStation, transactionConnector);
    }
  }

  private static async checkAndGetAuthorizedUserFromTag(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation,
      transaction: Transaction, tag: Tag, authAction: Action): Promise<User> {
    // Get User
    const user = await UserStorage.getUser(tenant.id, tag.user.id);
    // User status
    if (user.status !== UserStatus.ACTIVE) {
      throw new BackendError({
        source: chargingStation.id,
        action: action,
        message: `User with Tag ID '${tag.id}' is not Active ('${Utils.getStatusDescription(user.status)}')`,
        module: MODULE_NAME,
        method: 'checkAndGetAuthorizedUser',
        user: user
      });
    }
    // Check Auth if local User
    if (user.issuer && authAction) {
      // Build the JWT Token
      const userToken = await Authorizations.buildUserToken(tenant.id, user, [tag]);
      // Authorized?
      const context: AuthorizationContext = {
        user: transaction ? transaction.userID : null,
        tagIDs: userToken.tagIDs,
        tagID: transaction ? transaction.tagID : null,
        owner: userToken.id,
        site: chargingStation.siteID,
        sites: userToken.sites,
        sitesAdmin: userToken.sitesAdmin
      };
      if (!await Authorizations.canPerformActionOnChargingStation(userToken, authAction, chargingStation, context)) {
        throw new BackendError({
          source: chargingStation.id,
          action: action,
          message: `User with Tag ID '${tag.id}' is not authorized to perform the action '${authAction}'`,
          module: MODULE_NAME,
          method: 'checkAndGetAuthorizedUser',
          user: tag.user,
          detailedMessages: { userToken, tag }
        });
      }
    }
    return user;
  }

  private static async createInactiveTagAndAbortAction(
      action: ServerAction, tenant: Tenant, tagID: string, chargingStation: ChargingStation) {
    const tag: Tag = {
      id: tagID,
      description: `Badged on '${chargingStation.id}'`,
      issuer: true,
      active: false,
      createdOn: new Date(),
      default: false
    };
    // Save
    await TagStorage.saveTag(tenant.id, tag);
    // Notify (Async)
    NotificationHandler.sendUnknownUserBadged(
      tenant,
      Utils.generateUUID(),
      chargingStation,
      {
        chargeBoxID: chargingStation.id,
        badgeID: tagID,
        evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
        evseDashboardTagURL: Utils.buildEvseTagURL(tenant.subdomain, tag)
      }
    ).catch(() => { });
    throw new BackendError({
      source: chargingStation.id,
      action: action,
      module: MODULE_NAME, method: 'createAndGetInactiveTag',
      message: `Tag ID '${tagID}' is unknown and has been created successfully as an inactive Tag`,
      detailedMessages: { tag }
    });
  }

  private static async checkAndGetOICPAuthorizedUser(action: ServerAction, tenant: Tenant, transaction: Transaction, tagID: string) {
    if (Utils.isTenantComponentActive(tenant, TenantComponents.OICP)) {
      // Check if user has remote authorization or the session is already running
      if (tagID === OICPDefaultTagId.RemoteIdentification || transaction?.oicpData?.session?.id) {
        return UserStorage.getUserByEmail(tenant.id, Constants.OICP_VIRTUAL_USER_EMAIL);
      }
      // Get the client
      const oicpClient = await OICPClientFactory.getAvailableOicpClient(tenant, OICPRole.CPO) as CpoOICPClient;
      if (!oicpClient) {
        throw new BackendError({
          action,
          module: MODULE_NAME, method: 'checkAndGetOICPAuthorizedUser',
          message: 'OICP component requires at least one CPO endpoint to start a Session'
        });
      }
      // Check the Tag and retrieve the authorization
      const response = await oicpClient.authorizeStart(tagID);
      if (response?.AuthorizationStatus === OICPAuthorizationStatus.Authorized) {
        const virtualOICPUser = await UserStorage.getUserByEmail(tenant.id, Constants.OICP_VIRTUAL_USER_EMAIL);
        virtualOICPUser.authorizationID = response.SessionID;
        return virtualOICPUser;
      }
    }
  }

  private static async checkAndGetAuthorizedTag(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation, tagID: string): Promise<Tag> {
    // Get Tag
    const tag = await TagStorage.getTag(tenant.id, tagID, { withUser: true });
    if (tag) {
      // Inactive Tag
      if (!tag.active) {
        throw new BackendError({
          source: chargingStation.id,
          action: action,
          message: `Tag ID '${tagID}' is not active`,
          module: MODULE_NAME, method: 'checkAndGetAuthorizedTag',
          user: tag.user,
          detailedMessages: { tag }
        });
      }
      // No User
      if (!tag.user) {
        throw new BackendError({
          source: chargingStation.id,
          action: action,
          message: `Tag ID '${tagID}' is not assigned to a User`,
          module: MODULE_NAME, method: 'checkAndGetAuthorizedTag',
          user: tag.user,
          detailedMessages: { tag }
        });
      }
    }
    return tag;
  }

  private static getConfiguration() {
    if (!Authorizations.configuration) {
      Authorizations.configuration = Configuration.getAuthorizationConfig();
    }
    return Authorizations.configuration;
  }

  private static getAuthGroupsFromUser(userRole: string, sitesAdminCount: number, sitesOwnerCount: number): string[] {
    const roles: Array<string> = [];
    switch (userRole) {
      case UserRole.ADMIN:
        roles.push('admin');
        break;
      case UserRole.SUPER_ADMIN:
        roles.push('superAdmin');
        break;
      case UserRole.BASIC:
        if (sitesAdminCount > 0) {
          roles.push('siteAdmin');
        }
        if (sitesOwnerCount > 0) {
          roles.push('siteOwner');
        }
        if (Utils.isEmptyArray(roles)) {
          roles.push('basic');
        }
        break;
      case UserRole.DEMO:
        roles.push('demo');
        break;
    }
    return roles;
  }

  private static async canPerformAction(loggedUser: UserToken, entity: Entity, action: Action, context?: AuthorizationContext): Promise<boolean> {
    // Check
    const authDefinition = AuthorizationsDefinition.getInstance();
    const authorized = await authDefinition.can(loggedUser.rolesACL, entity, action, context);
    if (!authorized && Authorizations.getConfiguration().debug) {
      void Logging.logSecurityInfo({
        tenantID: loggedUser.tenantID, user: loggedUser,
        action: ServerAction.AUTHORIZATIONS,
        module: MODULE_NAME, method: 'canPerformAction',
        message: `Role ${loggedUser.role} Cannot ${action} on ${entity} with context ${JSON.stringify(context)}`,
      });
    }
    return authorized;
  }
}
