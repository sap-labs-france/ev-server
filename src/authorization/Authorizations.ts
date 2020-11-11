import { Action, AuthorizationContext, Entity } from '../types/Authorization';
import User, { UserRole, UserStatus } from '../types/User';

import AuthorizationConfiguration from '../types/configuration/AuthorizationConfiguration';
import AuthorizationsDefinition from './AuthorizationsDefinition';
import BackendError from '../exception/BackendError';
import ChargingStation from '../types/ChargingStation';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import NotificationHandler from '../notification/NotificationHandler';
import { PricingSettingsType } from '../types/Setting';
import { ServerAction } from '../types/Server';
import SessionHashService from '../server/rest/v1/service/SessionHashService';
import SettingStorage from '../storage/mongodb/SettingStorage';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../storage/mongodb/SiteStorage';
import Tag from '../types/Tag';
import TenantComponents from '../types/TenantComponents';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Transaction from '../types/Transaction';
import UserStorage from '../storage/mongodb/UserStorage';
import UserToken from '../types/UserToken';
import Utils from '../utils/Utils';

const MODULE_NAME = 'Authorizations';

export default class Authorizations {

  private static configuration: AuthorizationConfiguration;

  public static canRefundTransaction(loggedUser: UserToken, transaction: Transaction): boolean {
    const context: AuthorizationContext = {
      UserID: transaction.userID,
      sitesOwner: loggedUser.sitesOwner,
      site: transaction.siteID
    };
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION,
      Action.REFUND_TRANSACTION, context);
  }

  public static canStartTransaction(loggedUser: UserToken, chargingStation: ChargingStation): boolean {
    let context;
    if (Utils.isComponentActiveFromToken(loggedUser, TenantComponents.ORGANIZATION)) {
      if (!chargingStation || !chargingStation.siteArea || !chargingStation.siteArea.site) {
        return false;
      }
      context = {
        site: chargingStation.siteArea.site.id,
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

  public static canStopTransaction(loggedUser: UserToken, transaction: Transaction): boolean {
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

  public static getAuthorizedCompanyIDs(loggedUser: UserToken): string[] {
    return loggedUser.companies;
  }

  public static getAuthorizedSiteIDs(loggedUser: UserToken, requestedSites: string[]): string[] {
    if (!Utils.isComponentActiveFromToken(loggedUser, TenantComponents.ORGANIZATION)) {
      return null;
    }
    if (this.isAdmin(loggedUser)) {
      return requestedSites;
    }
    if (!requestedSites || requestedSites.length === 0) {
      return loggedUser.sites;
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
    if (!requestedSites || requestedSites.length === 0) {
      return [...sites];
    }
    return requestedSites.filter((site) => sites.has(site));
  }

  public static async buildUserToken(tenantID: string, user: User, tags: Tag[]): Promise<UserToken> {
    const companyIDs = new Set<string>();
    const siteIDs = [];
    const siteAdminIDs = [];
    const siteOwnerIDs = [];
    // Get User's site
    const sites = (await UserStorage.getUserSites(tenantID, { userID: user.id },
      Constants.DB_PARAMS_MAX_LIMIT)).result;
    sites.forEach((siteUser) => {
      if (!Authorizations.isAdmin(user)) {
        siteIDs.push(siteUser.site.id);
        companyIDs.add(siteUser.site.companyID);
        if (siteUser.siteAdmin) {
          siteAdminIDs.push(siteUser.site.id);
        }
      }
      if (siteUser.siteOwner) {
        siteOwnerIDs.push(siteUser.site.id);
      }
    });
    let tenantHashID = Constants.DEFAULT_TENANT;
    let activeComponents = [];
    let tenantName;
    if (tenantID !== Constants.DEFAULT_TENANT) {
      const tenant = await TenantStorage.getTenant(tenantID);
      tenantName = tenant.name;
      tenantHashID = SessionHashService.buildTenantHashID(tenant);
      activeComponents = Utils.getTenantActiveComponents(tenant);
    }
    // Currency
    let currency = null;
    const pricing = await SettingStorage.getPricingSettings(tenantID);
    if (pricing && pricing.type === PricingSettingsType.SIMPLE) {
      currency = pricing.simple.currency;
    }
    return {
      'id': user.id,
      'role': user.role,
      'name': user.name,
      'mobile': user.mobile,
      'email': user.email,
      'tagIDs': tags ? tags.filter((tag) => tag.active).map((tag) => tag.id) : [],
      'firstName': user.firstName,
      'locale': user.locale,
      'language': Utils.getLanguageFromLocale(user.locale),
      'currency': currency,
      'tenantID': tenantID,
      'tenantName': tenantName,
      'userHashID': SessionHashService.buildUserHashID(user),
      'tenantHashID': tenantHashID,
      'scopes': Authorizations.getUserScopes(tenantID, user, siteAdminIDs.length, siteOwnerIDs.length),
      'companies': [...companyIDs],
      'sitesAdmin': siteAdminIDs,
      'sitesOwner': siteOwnerIDs,
      'sites': siteIDs,
      'activeComponents': activeComponents
    };
  }

  public static async isAuthorizedOnChargingStation(tenantID: string, chargingStation: ChargingStation,
    tagID: string, action: ServerAction, authAction: Action): Promise<User> {
    return await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, null, tagID, action, authAction);
  }

  public static async isAuthorizedToStartTransaction(tenantID: string, chargingStation: ChargingStation,
    tagID: string, action: ServerAction, authAction?: Action): Promise<User> {
    return await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, null, tagID, action, authAction);
  }

  public static async isAuthorizedToStopTransaction(tenantID: string, chargingStation: ChargingStation,
    transaction: Transaction, tagID: string, action: ServerAction, authAction?: Action): Promise<{ user: User; alternateUser: User }> {
    let user: User, alternateUser: User;
    // Check if same user
    if (tagID !== transaction.tagID) {
      alternateUser = await Authorizations.isTagIDAuthorizedOnChargingStation(
        tenantID, chargingStation, transaction, tagID, action, authAction);
      user = await UserStorage.getUserByTagId(tenantID, transaction.tagID);
    } else {
      // Check user
      user = await Authorizations.isTagIDAuthorizedOnChargingStation(
        tenantID, chargingStation, transaction, transaction.tagID, action, authAction);
    }
    return { user, alternateUser };
  }

  public static canListLoggings(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.LOGGINGS, Action.LIST);
  }

  public static canReadLog(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.LOGGING, Action.READ);
  }

  public static canListTransactions(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTIONS, Action.LIST);
  }

  public static canListTransactionsInError(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTIONS, Action.LIST);
  }

  public static canReadTransaction(loggedUser: UserToken, transaction: Transaction): boolean {
    if (!transaction) {
      return false;
    }
    const context = {
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

  public static canReadReport(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.REPORT, Action.READ);
  }

  public static canUpdateTransaction(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION, Action.UPDATE);
  }

  public static canDeleteTransaction(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION, Action.DELETE);
  }

  public static canListChargingStations(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATIONS, Action.LIST);
  }

  public static canPerformActionOnChargingStation(loggedUser: UserToken, action: Action, chargingStation: ChargingStation, context?: AuthorizationContext): boolean {
    if (!context) {
      const isOrgCompActive = Utils.isComponentActiveFromToken(loggedUser, TenantComponents.ORGANIZATION);
      context = {
        tagIDs: loggedUser.tagIDs,
        owner: loggedUser.id,
        site: isOrgCompActive && chargingStation.siteArea ? chargingStation.siteArea.site.id : null,
        sites: loggedUser.sites,
        sitesAdmin: loggedUser.sitesAdmin
      };
    }
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, action, context);
  }

  public static canReadChargingStation(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.READ);
  }

  public static canUpdateChargingStation(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.UPDATE, {
      site: siteID,
      sitesAdmin: loggedUser.sitesAdmin
    });
  }

  public static canDeleteChargingStation(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.DELETE, {
      site: siteID,
      sitesAdmin: loggedUser.sitesAdmin
    });
  }

  public static canExportParams(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.EXPORT_PARAMS, {
      site: siteID,
      sitesAdmin: loggedUser.sitesAdmin
    });

  }

  public static canListUsers(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USERS, Action.LIST);
  }

  public static canListTags(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TAGS, Action.LIST);
  }

  public static canReadTag(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TAG, Action.READ);
  }

  public static canDeleteTag(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TAG, Action.DELETE);
  }

  public static canCreateTag(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TAG, Action.CREATE);
  }

  public static canUpdateTag(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TAG, Action.UPDATE);
  }

  public static canReadUser(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USER, Action.READ,
      { user: userId, owner: loggedUser.id });
  }

  public static canCreateUser(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USER, Action.CREATE);
  }

  public static canUpdateUser(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USER, Action.UPDATE,
      { user: userId, owner: loggedUser.id });
  }

  public static canDeleteUser(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USER, Action.DELETE,
      { user: userId, owner: loggedUser.id });
  }

  public static canListSites(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITES, Action.LIST);
  }

  public static canReadSite(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE, Action.READ,
      { site: siteID, sites: loggedUser.sites });
  }

  public static canCreateSite(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE, Action.CREATE);
  }

  public static canUpdateSite(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE, Action.UPDATE,
      { site: siteID, sitesAdmin: loggedUser.sitesAdmin, sitesOwner: loggedUser.sitesOwner });
  }

  public static canDeleteSite(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE, Action.DELETE,
      { site: siteID, sites: loggedUser.sitesAdmin });
  }

  public static canListSettings(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTINGS, Action.LIST);
  }

  public static canReadSetting(loggedUser: UserToken, context?): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTING, Action.READ, context);
  }

  public static canDeleteSetting(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTING, Action.DELETE);
  }

  public static canCreateSetting(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTING, Action.CREATE);
  }

  public static canUpdateSetting(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SETTING, Action.UPDATE);
  }

  public static canCreateRegistrationToken(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKEN, Action.CREATE, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static canReadRegistrationToken(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKEN, Action.READ, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static canDeleteRegistrationToken(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKEN, Action.DELETE, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static canUpdateRegistrationToken(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKEN, Action.UPDATE, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static canListRegistrationTokens(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKENS, Action.LIST);
  }

  public static canListOcpiEndpoints(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINTS, Action.LIST);
  }

  public static canReadOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.READ);
  }

  public static canDeleteOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.DELETE);
  }

  public static canCreateOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.CREATE);
  }

  public static canUpdateOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.UPDATE);
  }

  public static canPingOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.PING);
  }

  public static canTriggerJobOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.TRIGGER_JOB);
  }

  public static canRegisterOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.REGISTER);
  }

  public static canGenerateLocalTokenOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.GENERATE_LOCAL_TOKEN);
  }

  public static canListChargingProfiles(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_PROFILES, Action.LIST);
  }

  public static canReadChargingProfile(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_PROFILE, Action.READ,{
      site: siteID,
      sitesAdmin: loggedUser.sitesAdmin
    });
  }

  public static canListSiteAreas(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE_AREAS, Action.LIST);
  }

  public static canReadSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE_AREA, Action.READ,
      { site: siteID, sites: loggedUser.sites });
  }

  public static canCreateSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE_AREA, Action.CREATE,
      { site: siteID, sites: loggedUser.sitesAdmin });
  }

  public static canUpdateSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE_AREA, Action.UPDATE, {
      site: siteID, sites: loggedUser.sitesAdmin
    });
  }

  public static canDeleteSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE_AREA, Action.DELETE,
      { site: siteID, sites: loggedUser.sitesAdmin });
  }

  public static canListCompanies(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.COMPANIES, Action.LIST);
  }

  public static canReadCompany(loggedUser: UserToken, companyId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.COMPANY, Action.READ,
      { company: companyId, companies: loggedUser.companies });
  }

  public static canCreateCompany(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.COMPANY, Action.CREATE);
  }

  public static canUpdateCompany(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.COMPANY, Action.UPDATE);
  }

  public static canDeleteCompany(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.COMPANY, Action.DELETE);
  }

  public static canListCarCatalogs(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CAR_CATALOGS, Action.LIST);
  }

  public static canReadCarCatalog(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CAR_CATALOG, Action.READ);
  }

  public static canListCars(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CARS, Action.LIST);
  }

  public static canReadCar(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CAR, Action.READ);
  }

  public static canListUsersCars(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USERS_CARS, Action.LIST);
  }

  public static canAssignUsersCars(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USERS_CARS, Action.ASSIGN);
  }

  public static canSynchronizeCarCatalogs(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CAR_CATALOGS, Action.SYNCHRONIZE);
  }

  public static canCreateCar(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CAR, Action.CREATE);
  }

  public static canUpdateCar(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CAR, Action.UPDATE);
  }

  public static canDeleteCar(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CAR, Action.DELETE);
  }

  public static canListAssets(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSETS, Action.LIST);
  }

  public static canReadAsset(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.READ);
  }

  public static canCreateAsset(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.CREATE);
  }

  public static canUpdateAsset(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.UPDATE);
  }

  public static canDeleteAsset(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.DELETE);
  }

  public static canListTenants(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TENANTS, Action.LIST);
  }

  public static canReadTenant(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TENANT, Action.READ);
  }

  public static canCreateTenant(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TENANT, Action.CREATE);
  }

  public static canUpdateTenant(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TENANT, Action.UPDATE);
  }

  public static canDeleteTenant(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TENANT, Action.DELETE);
  }

  public static canCreateConnection(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CONNECTION, Action.CREATE);
  }

  public static canDeleteConnection(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CONNECTION, Action.DELETE,
      { user: userId, owner: loggedUser.id });
  }

  public static canReadConnection(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CONNECTION, Action.READ,
      { user: userId, owner: loggedUser.id });
  }

  public static canListConnections(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CONNECTIONS, Action.LIST);
  }

  public static canReadPricing(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.PRICING, Action.READ);
  }

  public static canUpdatePricing(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.PRICING, Action.UPDATE);
  }

  public static canCheckConnectionBilling(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.BILLING, Action.CHECK_CONNECTION);
  }

  public static canSynchronizeUsersBilling(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USERS, Action.SYNCHRONIZE_BILLING_USERS);
  }

  public static canSynchronizeUserBilling(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USER, Action.SYNCHRONIZE_BILLING_USER);
  }

  public static canReadTaxesBilling(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TAXES, Action.LIST);
  }

  public static canListInvoicesBilling(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICES, Action.LIST);
  }

  public static canSynchronizeInvoicesBilling(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICES, Action.SYNCHRONIZE);
  }

  public static canCreateTransactionInvoice(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICE, Action.CREATE);
  }

  public static canDownloadInvoiceBilling(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICE, Action.DOWNLOAD,
      { user: userId, owner: loggedUser.id });
  }

  public static canCheckAssetConnection(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.CHECK_CONNECTION);
  }

  public static canRetrieveAssetConsumption(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.RETRIEVE_CONSUMPTION);
  }

  public static canEndUserReportError(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.NOTIFICATION, Action.CREATE);
  }

  public static isSuperAdmin(user: UserToken | User): boolean {
    return user.role === UserRole.SUPER_ADMIN;
  }

  public static isAdmin(user: UserToken | User): boolean {
    return user.role === UserRole.ADMIN;
  }

  public static isSiteAdmin(user: UserToken): boolean {
    return user.role === UserRole.BASIC && user.sitesAdmin && user.sitesAdmin.length > 0;
  }

  public static isSiteOwner(user: UserToken): boolean {
    return user.sitesOwner && user.sitesOwner.length > 0;
  }

  public static isBasic(user: UserToken | User): boolean {
    return user.role === UserRole.BASIC;
  }

  public static isDemo(user: UserToken | User): boolean {
    return user.role === UserRole.DEMO;
  }

  private static async isTagIDAuthorizedOnChargingStation(tenantID: string, chargingStation: ChargingStation,
    transaction: Transaction, tagID: string, action: ServerAction, authAction: Action): Promise<User> {
    // Get the Organization component
    const tenant = await TenantStorage.getTenant(tenantID);
    const isOrgCompActive = Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION);
    // Org component enabled?
    if (isOrgCompActive) {
      let foundSiteArea = true;
      // Site Area -----------------------------------------------
      if (!chargingStation.siteAreaID) {
        foundSiteArea = false;
      } else if (!chargingStation.siteArea) {
        chargingStation.siteArea = await SiteAreaStorage.getSiteArea(
          tenantID, chargingStation.siteAreaID, { withSite: true });
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
        });
      }
      // Access Control Enabled?
      if (!chargingStation.siteArea.accessControl) {
        // No ACL: Always try to get the user
        return UserStorage.getUserByTagId(tenantID, tagID);
      }
      // Site -----------------------------------------------------
      chargingStation.siteArea.site = chargingStation.siteArea.site ?
        chargingStation.siteArea.site : (chargingStation.siteArea.siteID ?
          await SiteStorage.getSite(tenantID, chargingStation.siteArea.siteID) : null);
      if (!chargingStation.siteArea.site) {
        // Reject Site Not Found
        throw new BackendError({
          source: chargingStation.id,
          action: action,
          module: MODULE_NAME, method: 'isTagIDAuthorizedOnChargingStation',
          message: `Site Area '${chargingStation.siteArea.name}' is not assigned to a Site!`,
        });
      }
    }
    // Get Tag
    let tag = await UserStorage.getTag(tenantID, tagID, { withUser: true });
    if (!tag) {
      // Create the tag as inactive
      tag = {
        id: tagID,
        description: `Badged on '${chargingStation.id}'`,
        issuer: true,
        active: false,
        createdOn: new Date(),
        default: false
      } as Tag;
      // Save
      await UserStorage.saveTag(tenantID, tag);
      // Notify (Async)
      NotificationHandler.sendUnknownUserBadged(
        tenantID,
        Utils.generateUUID(),
        chargingStation,
        {
          chargeBoxID: chargingStation.id,
          badgeID: tagID,
          evseDashboardURL: Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain),
          evseDashboardTagURL: await Utils.buildEvseTagURL(tenantID, tag)
        }
      ).catch(() => { });
      // Log
      Logging.logWarning({
        tenantID: tenantID,
        source: chargingStation.id,
        action: action,
        module: MODULE_NAME, method: 'isTagIDAuthorizedOnChargingStation',
        message: `Tag ID '${tagID}' is unknown and has been created successfully as an inactive Tag`
      });
    }
    // Inactive Tag
    if (!tag.active) {
      throw new BackendError({
        source: chargingStation.id,
        action: action,
        message: `Tag ID '${tagID}' is not active`,
        module: MODULE_NAME,
        method: 'isTagIDAuthorizedOnChargingStation',
        user: tag.user
      });
    }
    // No User
    if (!tag.user) {
      throw new BackendError({
        source: chargingStation.id,
        action: action,
        message: `Tag ID '${tagID}' is not assigned to a User`,
        module: MODULE_NAME,
        method: 'isTagIDAuthorizedOnChargingStation',
        user: tag.user
      });
    }
    // Check User
    const user = await UserStorage.getUser(tenantID, tag.user.id);
    // User status
    if (user.status !== UserStatus.ACTIVE) {
      // Reject but save ok
      throw new BackendError({
        source: chargingStation.id,
        action: action,
        message: `User with Tag ID '${tagID}' has the status '${Utils.getStatusDescription(user.status)}'`,
        module: MODULE_NAME,
        method: 'isTagIDAuthorizedOnChargingStation',
        user: user
      });
    }
    // Check Auth if local user
    if (user.issuer && authAction) {
      // Build the JWT Token
      const userToken = await Authorizations.buildUserToken(tenantID, user, [tag]);
      // Authorized?
      const context = {
        user: transaction ? transaction.userID : null,
        tagIDs: userToken.tagIDs,
        tagID: transaction ? transaction.tagID : null,
        owner: userToken.id,
        site: isOrgCompActive && chargingStation.siteArea ? chargingStation.siteArea.site.id : null,
        sites: userToken.sites,
        sitesAdmin: userToken.sitesAdmin
      };
      if (!Authorizations.canPerformActionOnChargingStation(userToken, authAction, chargingStation, context)) {
        throw new BackendError({
          source: chargingStation.id,
          action: action,
          message: `User with Tag ID '${tagID}' is not authorized to perform the action '${authAction}'`,
          module: MODULE_NAME,
          method: 'isTagIDAuthorizedOnChargingStation',
          user: tag.user
        });
      }
    }
    return user;
  }

  private static getUserScopes(tenantID: string, user: User, sitesAdminCount: number, sitesOwnerCount: number): ReadonlyArray<string> {
    // Get the group from User's role
    const groups = Authorizations.getAuthGroupsFromUser(user.role, sitesAdminCount, sitesOwnerCount);
    // Return the scopes
    return AuthorizationsDefinition.getInstance().getScopes(groups);
  }

  private static getConfiguration() {
    if (!Authorizations.configuration) {
      Authorizations.configuration = Configuration.getAuthorizationConfig();
    }
    return Authorizations.configuration;
  }

  private static getAuthGroupsFromUser(userRole: string, sitesAdminCount: number, sitesOwnerCount: number): ReadonlyArray<string> {
    const groups: Array<string> = [];
    switch (userRole) {
      case UserRole.ADMIN:
        groups.push('admin');
        break;
      case UserRole.SUPER_ADMIN:
        groups.push('superAdmin');
        break;
      case UserRole.BASIC:
        groups.push('basic');
        // Check Site Admin
        if (sitesAdminCount > 0) {
          groups.push('siteAdmin');
        }
        break;
      case UserRole.DEMO:
        groups.push('demo');
        break;
    }

    if (sitesOwnerCount > 0) {
      groups.push('siteOwner');
    }
    return groups;
  }

  private static canPerformAction(loggedUser: UserToken, entity: Entity, action: Action, context?: AuthorizationContext): boolean {
    // Get the groups
    const groups = Authorizations.getAuthGroupsFromUser(loggedUser.role,
      loggedUser.sitesAdmin ? loggedUser.sitesAdmin.length : 0,
      loggedUser.sitesOwner ? loggedUser.sitesOwner.length : 0);
    // Check
    const authorized = AuthorizationsDefinition.getInstance().can(groups, entity, action, context);
    if (!authorized && Authorizations.getConfiguration().debug) {
      Logging.logSecurityInfo({
        tenantID: loggedUser.tenantID, user: loggedUser,
        action: ServerAction.AUTHORIZATIONS,
        module: MODULE_NAME, method: 'canPerformAction',
        message: `Role ${loggedUser.role} Cannot ${action} on ${entity} with context ${JSON.stringify(context)}`,
      });
    }
    return authorized;
  }
}
