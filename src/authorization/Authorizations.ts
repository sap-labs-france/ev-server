import { Action, Entity, Role } from '../types/Authorization';
import { HTTPAuthError, HTTPError  } from '../types/HTTPError';
import User, { Status } from '../types/User';
import AppAuthError from '../exception/AppAuthError';
import AppError from '../exception/AppError';
import AuthorizationConfiguration from '../types/configuration/AuthorizationConfiguration';
import AuthorizationsDefinition from './AuthorizationsDefinition';
import ChargingStation from '../types/ChargingStation';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import NotificationHandler from '../notification/NotificationHandler';
import { PricingSettingsType } from '../types/Setting';
import SessionHashService from '../server/rest/service/SessionHashService';
import SettingStorage from '../storage/mongodb/SettingStorage';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../storage/mongodb/SiteStorage';
import Tag from '../types/Tag';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Transaction from '../types/Transaction';
import UserNotifications from '../types/UserNotifications';
import UserStorage from '../storage/mongodb/UserStorage';
import UserToken from '../types/UserToken';
import Utils from '../utils/Utils';

export default class Authorizations {

  private static configuration: AuthorizationConfiguration;

  public static canRefundTransaction(loggedUser: UserToken, transaction: Transaction) {
    const context = {
      'UserID': transaction.userID,
      'sitesOwner': loggedUser.sitesOwner,
      'site': transaction.siteID
    };
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION,
      Action.REFUND_TRANSACTION, context);
  }

  public static canStartTransaction(loggedUser: UserToken, chargingStation: ChargingStation) {
    let context;
    if (Utils.isComponentActiveFromToken(loggedUser, Constants.COMPONENTS.ORGANIZATION)) {
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

  public static canStopTransaction(loggedUser: UserToken, transaction: Transaction) {
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
      sitesAdmin: loggedUser.sitesAdmin
    };

    return Authorizations.canPerformAction(
      loggedUser, Entity.CHARGING_STATION,
      Action.REMOTE_STOP_TRANSACTION, context);
  }

  public static getAuthorizedCompanyIDs(loggedUser: UserToken): string[] {
    return loggedUser.companies;
  }

  public static getAuthorizedSiteIDs(loggedUser: UserToken, requestedSites: string[]): string[] {
    if (!Utils.isComponentActiveFromToken(loggedUser, Constants.COMPONENTS.ORGANIZATION)) {
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
    if (!Utils.isComponentActiveFromToken(loggedUser, Constants.COMPONENTS.ORGANIZATION)) {
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

  public static async buildUserToken(tenantID: string, user: User): Promise<UserToken> {
    const companyIDs = new Set<string>();
    const siteIDs = [];
    const siteAdminIDs = [];
    const siteOwnerIDs = [];
    // Get User's site
    const sites = (await UserStorage.getSites(tenantID, { userID: user.id },
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
      'tagIDs': user.tags ? user.tags.map((tag) => tag.id) : [],
      'firstName': user.firstName,
      'locale': user.locale,
      'language': user.locale.substring(0, 2),
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

  public static async isAuthorizedOnChargingStation(tenantID: string, chargingStation: ChargingStation, tagID: string): Promise<User> {
    return await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, null, tagID, Action.AUTHORIZE);
  }

  public static async isAuthorizedToStartTransaction(tenantID: string, chargingStation: ChargingStation, tagID: string): Promise<User> {
    return await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, null, tagID, Action.REMOTE_START_TRANSACTION);
  }

  public static async isAuthorizedToStopTransaction(tenantID: string, chargingStation: ChargingStation, transaction: Transaction, tagId: string) {
    let user: User, alternateUser: User;
    // Check if same user
    if (tagId !== transaction.tagID) {
      alternateUser = await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, transaction, tagId, Action.REMOTE_STOP_TRANSACTION);
      user = await UserStorage.getUserByTagId(tenantID, transaction.tagID);
    } else {
      // Check user
      user = await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, transaction, transaction.tagID, Action.REMOTE_STOP_TRANSACTION);
    }
    return { user, alternateUser };
  }

  public static canListLogging(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.LOGGINGS, Action.LIST);
  }

  public static canReadLogging(loggedUser: UserToken): boolean {
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

  public static canPerformActionOnChargingStation(loggedUser: UserToken, action: string, chargingStation: ChargingStation, context?: any): boolean {
    if (!context) {
      const isOrgCompActive = Utils.isComponentActiveFromToken(loggedUser, Constants.COMPONENTS.ORGANIZATION);
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
      'site': siteID,
      'sitesAdmin': loggedUser.sitesAdmin
    });
  }

  public static canDeleteChargingStation(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.DELETE, {
      'site': siteID,
      'sitesAdmin': loggedUser.sitesAdmin
    });
  }

  public static canExportParams(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.EXPORT_PARAMS, {
      'site': siteID,
      'sitesAdmin': loggedUser.sitesAdmin
    });

  }

  public static canListUsers(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USERS, Action.LIST);
  }

  public static canReadUser(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USER, Action.READ,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canCreateUser(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USER, Action.CREATE);
  }

  public static canUpdateUser(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USER, Action.UPDATE,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canDeleteUser(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.USER, Action.DELETE,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canListSites(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITES, Action.LIST);
  }

  public static canReadSite(loggedUser: UserToken, siteId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE, Action.READ,
      { 'site': siteId, 'sites': loggedUser.sites });
  }

  public static canCreateSite(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE, Action.CREATE);
  }

  public static canUpdateSite(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE, Action.UPDATE,
      { 'site': siteID, 'sitesAdmin': loggedUser.sitesAdmin, 'sitesOwner': loggedUser.sitesOwner });
  }

  public static canDeleteSite(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE, Action.DELETE,
      { 'site': siteID, 'sites': loggedUser.sitesAdmin });
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
      'site': siteID,
      'sites': loggedUser.sitesAdmin
    });
  }

  public static canReadRegistrationToken(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKEN, Action.READ, {
      'site': siteID,
      'sites': loggedUser.sitesAdmin
    });
  }

  public static canDeleteRegistrationToken(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKEN, Action.DELETE);
  }

  public static canUpdateRegistrationToken(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.TOKEN, Action.UPDATE);
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

  public static canListVehicles(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.VEHICLES, Action.LIST);
  }

  public static canReadVehicle(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.VEHICLE, Action.READ);
  }

  public static canCreateVehicle(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.VEHICLE, Action.CREATE);
  }

  public static canUpdateVehicle(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.VEHICLE, Action.UPDATE);
  }

  public static canDeleteVehicle(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.VEHICLE, Action.DELETE);
  }

  public static canListVehicleManufacturers(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.VEHICLE_MANUFACTURERS, Action.LIST);
  }

  public static canReadVehicleManufacturer(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.VEHICLE_MANUFACTURER, Action.READ);
  }

  public static canCreateVehicleManufacturer(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.VEHICLE_MANUFACTURER, Action.CREATE);
  }

  public static canUpdateVehicleManufacturer(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.VEHICLE_MANUFACTURER, Action.UPDATE);
  }

  public static canDeleteVehicleManufacturer(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.VEHICLE_MANUFACTURER, Action.DELETE);
  }

  public static canListSiteAreas(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE_AREAS, Action.LIST);
  }

  public static canReadSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE_AREA, Action.READ,
      { 'site': siteID, 'sites': loggedUser.sites });
  }

  public static canCreateSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE_AREA, Action.CREATE,
      { 'site': siteID, 'sites': loggedUser.sitesAdmin });
  }

  public static canUpdateSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE_AREA, Action.UPDATE, {
      'site': siteID,
      'sites': loggedUser.sitesAdmin
    });
  }

  public static canDeleteSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.SITE_AREA, Action.DELETE,
      { 'site': siteID, 'sites': loggedUser.sitesAdmin });
  }

  public static canListCompanies(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.COMPANIES, Action.LIST);
  }

  public static canReadCompany(loggedUser: UserToken, companyId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.COMPANY, Action.READ,
      { 'company': companyId, 'companies': loggedUser.companies });
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
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canReadConnection(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.CONNECTION, Action.READ,
      { 'user': userId, 'owner': loggedUser.id });
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
    return Authorizations.canPerformAction(loggedUser, Entity.BILLING, Action.CHECK_CONNECTION_BILLING);
  }

  public static canSynchronizeUsersBilling(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.BILLING, Action.SYNCHRONIZE_BILLING);
  }

  public static canReadBillingTaxes(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Entity.BILLING, Action.READ_BILLING_TAXES);
  }

  public static isSuperAdmin(user: UserToken | User): boolean {
    return user.role === Role.SUPER_ADMIN;
  }

  public static isAdmin(user: UserToken | User): boolean {
    return user.role === Role.ADMIN;
  }

  public static isSiteAdmin(user: UserToken): boolean {
    return user.role === Role.BASIC && user.sitesAdmin && user.sitesAdmin.length > 0;
  }

  public static isSiteOwner(user: UserToken): boolean {
    return user.sitesOwner && user.sitesOwner.length > 0;
  }

  public static isBasic(user: UserToken | User): boolean {
    return user.role === Role.BASIC;
  }

  public static isDemo(user: UserToken | User): boolean {
    return user.role === Role.DEMO;
  }

  private static async isTagIDAuthorizedOnChargingStation(tenantID: string, chargingStation: ChargingStation,
    transaction: Transaction, tagID: string, action: Action): Promise<User> {
    // Get the Organization component
    const tenant = await TenantStorage.getTenant(tenantID);
    const isOrgCompActive = Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.ORGANIZATION);
    // Org component enabled?
    if (isOrgCompActive) {
      let foundSiteArea = true;
      // Site Area -----------------------------------------------
      if (!chargingStation.siteAreaID) {
        foundSiteArea = false;
      } else if (!chargingStation.siteArea) {
        chargingStation.siteArea =
          await SiteAreaStorage.getSiteArea(tenantID, chargingStation.siteAreaID, { withSite: true });
        if (!chargingStation.siteArea) {
          foundSiteArea = false;
        }
      }
      // Site is mandatory
      if (!foundSiteArea) {
        // Reject Site Not Found
        throw new AppError({
          source: chargingStation.id,
          errorCode: HTTPError.CHARGER_WITH_NO_SITE_AREA_ERROR,
          message: `Charging Station '${chargingStation.id}' is not assigned to a Site Area!`,
          module: 'Authorizations',
          method: 'isTagIDAuthorizedOnChargingStation'
        });
      }

      // Access Control Enabled?
      if (!chargingStation.siteArea.accessControl) {
        // No control
        return;
      }
      // Site -----------------------------------------------------
      chargingStation.siteArea.site = chargingStation.siteArea.site ?
        chargingStation.siteArea.site : (chargingStation.siteArea.siteID ?
          await SiteStorage.getSite(tenantID, chargingStation.siteArea.siteID) : null);
      if (!chargingStation.siteArea.site) {
        // Reject Site Not Found
        throw new AppError({
          source: chargingStation.id,
          errorCode: HTTPError.SITE_AREA_WITH_NO_SITE_ERROR,
          message: `Site Area '${chargingStation.siteArea.name}' is not assigned to a Site!`,
          module: 'Authorizations',
          method: 'checkAndGetUserOnChargingStation'
        });
      }
    }
    // Get user
    let user: User = null;
    // Get the user
    if (tagID) {
      user = await Authorizations.checkAndGetUserTagIDOnChargingStation(
        tenantID, chargingStation, tagID, action);
    }
    // Found?
    if (user) {
      // Check Authorization
      // Check User status
      if (user.status !== Status.ACTIVE) {
        // Reject but save ok
        throw new AppError({
          source: chargingStation.id,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `User with Tag ID '${tagID}' has the status '${Utils.getStatusDescription(user.status)}'`,
          module: 'Authorizations',
          method: 'isTagIDAuthorizedOnChargingStation',
          user: user
        });
      }
      // Build the JWT Token
      const userToken = await Authorizations.buildUserToken(tenantID, user);
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
      if (!Authorizations.canPerformActionOnChargingStation(userToken, action, chargingStation, context)) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.ERROR,
          user: userToken,
          action: action,
          entity: Entity.CHARGING_STATION,
          value: chargingStation.id,
          module: 'Authorizations',
          method: '_checkAndGetUserOnChargingStation',
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

  private static async checkAndGetUserTagIDOnChargingStation(tenantID: string, chargingStation: ChargingStation, tagID: string, action: string): Promise<User> {
    let user = await UserStorage.getUserByTagId(tenantID, tagID);
    // Found?
    if (!user) {
      // Create an empty user
      user = {
        ...UserStorage.getEmptyUser(),
        email: tagID + '@e-mobility.com',
        status: Status.INACTIVE,
        role: Role.BASIC
      } as User;
      // Save User
      user.id = await UserStorage.saveUser(tenantID, user);
      // Save User TagIDs
      const tag: Tag = {
        id: tagID,
        deleted: false,
        issuer: false,
        userID: user.id,
        lastChangedOn: new Date()
      };
      await UserStorage.saveUserTags(tenantID, user.id, [tag]);
      // Save User Status
      await UserStorage.saveUserStatus(tenantID, user.id, user.status);
      // Save User Role
      await UserStorage.saveUserRole(tenantID, user.id, user.role);
      // Save User Admin data
      await UserStorage.saveUserAdminData(tenantID, user.id, {
        notificationsActive: user.notificationsActive,
        notifications: user.notifications
      });
      // No need to save the password as it is empty anyway
      // Notify (Async)
      NotificationHandler.sendUnknownUserBadged(
        tenantID,
        Utils.generateGUID(),
        chargingStation,
        {
          'chargeBoxID': chargingStation.id,
          'badgeID': tagID,
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).subdomain),
          'evseDashboardUserURL': await Utils.buildEvseUserURL(tenantID, user, '#inerror')
        }
      ).catch((err) => Logging.logError(err));
      // Not authorized
      throw new AppError({
        source: chargingStation.id,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `User with Tag ID '${tagID}' not found but saved as inactive user`,
        module: 'Authorizations',
        method: 'checkAndGetUserTagIDOnChargingStation',
        user: user
      });
    } else if (user.deleted) {
      // Set default user's value
      user.name = 'Unknown';
      user.firstName = 'User';
      user.email = tagID + '@e-mobility.fr';
      user.phone = '';
      user.mobile = '';
      user.notificationsActive = true;
      user.notifications = {
        sendSessionStarted: true,
        sendOptimalChargeReached: true,
        sendEndOfCharge: true,
        sendEndOfSession: true,
        sendUserAccountStatusChanged: true,
        sendUnknownUserBadged: false,
        sendChargingStationStatusError: false,
        sendChargingStationRegistered: false,
        sendOcpiPatchStatusError: false,
        sendSmtpAuthError: false
      } as UserNotifications;
      user.image = '';
      user.iNumber = '';
      user.costCenter = '';
      // Log
      Logging.logSecurityInfo({
        tenantID: tenantID, user: user,
        module: 'Authorizations', method: 'checkAndGetUserTagIDOnChargingStation',
        message: `User with ID '${user.id}' with Tag ID '${tagID}' has been restored`,
        action: action
      });
      // Save
      user.id = await UserStorage.saveUser(tenantID, user);
      // Save User Status
      await UserStorage.saveUserStatus(tenantID, user.id, Status.INACTIVE);
      // Save User Role
      await UserStorage.saveUserRole(tenantID, user.id, Role.BASIC);
      // Save User Admin data
      await UserStorage.saveUserAdminData(tenantID, user.id, {
        notificationsActive: user.notificationsActive,
        notifications: user.notifications
      });
    }
    return user;
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
      case Role.ADMIN:
        groups.push('admin');
        break;
      case Role.SUPER_ADMIN:
        groups.push('superAdmin');
        break;
      case Role.BASIC:
        groups.push('basic');
        // Check Site Admin
        if (sitesAdminCount > 0) {
          groups.push('siteAdmin');
        }
        break;
      case Role.DEMO:
        groups.push('demo');
        break;
    }

    if (sitesOwnerCount > 0) {
      groups.push('siteOwner');
    }

    return groups;
  }

  private static canPerformAction(loggedUser: UserToken, resource, action, context?): boolean {
    // Get the groups
    const groups = Authorizations.getAuthGroupsFromUser(loggedUser.role,
      loggedUser.sitesAdmin ? loggedUser.sitesAdmin.length : 0,
      loggedUser.sitesOwner ? loggedUser.sitesOwner.length : 0);

    // Check
    const authorized = AuthorizationsDefinition.getInstance().can(groups, resource, action, context);
    if (!authorized && Authorizations.getConfiguration().debug) {
      Logging.logSecurityInfo({
        tenantID: loggedUser.tenantID, user: loggedUser,
        module: 'Authorizations', method: 'canPerformAction',
        message: `Role ${loggedUser.role} Cannot ${action} on ${resource} with context ${JSON.stringify(context)}`,
        action: 'Authorizations'
      });
    }
    return authorized;
  }
}
