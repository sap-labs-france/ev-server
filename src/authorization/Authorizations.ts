import AppAuthError from '../exception/AppAuthError';
import AppError from '../exception/AppError';
import AuthorizationsDefinition from './AuthorizationsDefinition';
import ChargingStation from '../types/ChargingStation';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import NotificationHandler from '../notification/NotificationHandler';
import SessionHashService from '../server/rest/service/SessionHashService';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import SiteStorage from '../storage/mongodb/SiteStorage';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Transaction from '../types/Transaction';
import User from '../types/User';
import UserStorage from '../storage/mongodb/UserStorage';
import UserToken from '../types/UserToken';
import Utils from '../utils/Utils';
import UserNotifications from '../types/UserNotifications';

export default class Authorizations {

  private static configuration: any;

  public static canRefundTransaction(loggedUser: UserToken, transaction: Transaction) {
    const context = {
      'UserID': transaction.userID,
      'sitesAdmin': loggedUser.sitesAdmin,
      'site': transaction.siteID
    };
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
      Constants.ACTION_REFUND_TRANSACTION, context);
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
      loggedUser, Constants.ENTITY_CHARGING_STATION,
      Constants.ACTION_REMOTE_START_TRANSACTION, context);
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
      loggedUser, Constants.ENTITY_CHARGING_STATION,
      Constants.ACTION_REMOTE_STOP_TRANSACTION, context);
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

  public static getAuthorizedSiteAdminIDs(loggedUser: UserToken, requestedSites: string[]): string[] {
    if (!Utils.isComponentActiveFromToken(loggedUser, Constants.COMPONENTS.ORGANIZATION)) {
      return null;
    }
    if (this.isAdmin(loggedUser)) {
      return requestedSites;
    }
    if (!requestedSites || requestedSites.length === 0) {
      return loggedUser.sitesAdmin;
    }
    return requestedSites.filter((site) => loggedUser.sitesAdmin.includes(site));
  }

  public static async buildUserToken(tenantID: string, user: User): Promise<UserToken> {
    let companyIDs = [];
    let siteIDs = [];
    let siteAdminIDs = [];
    if (!Authorizations.isAdmin(user)) {
      // Get User's site
      const sites = (await UserStorage.getSites(tenantID, { userID: user.id },
        Constants.DB_PARAMS_MAX_LIMIT))
        .result.map((siteUser) => siteUser.site);
      // Get User's Site Admin
      const sitesAdmin = await UserStorage.getSites(
        tenantID, { userID: user.id, siteAdmin: true },
        Constants.DB_PARAMS_MAX_LIMIT,
        ['site.id']
      );
      // Assign
      siteIDs = sites.map((site) => site.id);
      companyIDs = [...new Set(sites.map((site) => site.companyID))];
      siteAdminIDs = sitesAdmin.result.map((siteUser) => siteUser.site.id);
    }

    let tenantHashID = Constants.DEFAULT_TENANT;
    let activeComponents = [];
    let tenantName;
    if (tenantID !== Constants.DEFAULT_TENANT) {
      const tenant = await TenantStorage.getTenant(tenantID);
      tenantName = tenant.name;
      tenantHashID = SessionHashService.buildTenantHashID(tenant);
      activeComponents = Utils.getTenantActiveComponents(tenant);
    }

    return {
      'id': user.id,
      'role': user.role,
      'name': user.name,
      'tagIDs': user.tagIDs,
      'firstName': user.firstName,
      'locale': user.locale,
      'language': user.locale.substring(0, 2),
      'tenantID': tenantID,
      'tenantName': tenantName,
      'userHashID': SessionHashService.buildUserHashID(user),
      'tenantHashID': tenantHashID,
      'scopes': Authorizations.getUserScopes(tenantID, user, siteAdminIDs.length),
      'companies': companyIDs,
      'sitesAdmin': siteAdminIDs,
      'sites': siteIDs,
      'activeComponents': activeComponents
    };
  }

  public static async isAuthorizedOnChargingStation(tenantID: string, chargingStation: ChargingStation, tagID: string): Promise<User> {
    return await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, null, tagID, Constants.ACTION_AUTHORIZE);
  }

  public static async isAuthorizedToStartTransaction(tenantID: string, chargingStation: ChargingStation, tagID: string): Promise<User> {
    return await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, null, tagID, Constants.ACTION_REMOTE_START_TRANSACTION);
  }

  public static async isAuthorizedToStopTransaction(tenantID: string, chargingStation: ChargingStation, transaction: Transaction, tagId: string) {
    let user: User, alternateUser: User;
    // Check if same user
    if (tagId !== transaction.tagID) {
      alternateUser = await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, transaction, tagId, Constants.ACTION_REMOTE_STOP_TRANSACTION);
      user = await UserStorage.getUserByTagId(tenantID, transaction.tagID);
    } else {
      // Check user
      user = await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, transaction, transaction.tagID, Constants.ACTION_REMOTE_STOP_TRANSACTION);
    }
    return { user, alternateUser };
  }

  public static canListLogging(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGINGS, Constants.ACTION_LIST);
  }

  public static canReadLogging(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGING, Constants.ACTION_READ);
  }

  public static canListTransactions(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS, Constants.ACTION_LIST);
  }

  public static canListTransactionsInError(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS, Constants.ACTION_LIST);
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
      sitesAdmin: loggedUser.sitesAdmin
    };
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_READ, context);
  }

  public static canUpdateTransaction(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_UPDATE);
  }

  public static canDeleteTransaction(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_DELETE);
  }

  public static canListChargingStations(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATIONS, Constants.ACTION_LIST);
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
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, action, context);
  }

  public static canReadChargingStation(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_READ);
  }

  public static canUpdateChargingStation(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_UPDATE, {
      'site': siteID,
      'sitesAdmin': loggedUser.sitesAdmin
    });
  }

  public static canDeleteChargingStation(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_DELETE, {
      'site': siteID,
      'sitesAdmin': loggedUser.sitesAdmin
    });
  }

  public static canListUsers(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USERS, Constants.ACTION_LIST);
  }

  public static canReadUser(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_READ,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canCreateUser(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_CREATE);
  }

  public static canUpdateUser(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_UPDATE,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canDeleteUser(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_DELETE,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canListSites(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITES, Constants.ACTION_LIST);
  }

  public static canReadSite(loggedUser: UserToken, siteId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_READ,
      { 'site': siteId, 'sites': loggedUser.sites });
  }

  public static canCreateSite(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_CREATE);
  }

  public static canUpdateSite(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_UPDATE,
      { 'site': siteID, 'sites': loggedUser.sitesAdmin });
  }

  public static canDeleteSite(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_DELETE,
      { 'site': siteID, 'sites': loggedUser.sitesAdmin });
  }

  public static canListSettings(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTINGS, Constants.ACTION_LIST);
  }

  public static canReadSetting(loggedUser: UserToken, context?): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_READ, context);
  }

  public static canDeleteSetting(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_DELETE);
  }

  public static canCreateSetting(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_CREATE);
  }

  public static canUpdateSetting(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_UPDATE);
  }

  public static canCreateRegistrationToken(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TOKEN, Constants.ACTION_CREATE, {
      'site': siteID,
      'sites': loggedUser.sitesAdmin
    });
  }

  public static canReadRegistrationToken(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TOKEN, Constants.ACTION_READ, {
      'site': siteID,
      'sites': loggedUser.sitesAdmin
    });
  }

  public static canDeleteRegistrationToken(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TOKEN, Constants.ACTION_DELETE);
  }

  public static canUpdateRegistrationToken(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TOKEN, Constants.ACTION_UPDATE);
  }

  public static canListRegistrationTokens(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TOKENS, Constants.ACTION_LIST);
  }

  public static canListOcpiEndpoints(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINTS, Constants.ACTION_LIST);
  }

  public static canReadOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_READ);
  }

  public static canDeleteOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_DELETE);
  }

  public static canCreateOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_CREATE);
  }

  public static canUpdateOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_UPDATE);
  }

  public static canPingOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_PING);
  }

  public static canSendEVSEStatusesOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_SEND_EVSE_STATUSES);
  }

  public static canRegisterOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_REGISTER);
  }

  public static canGenerateLocalTokenOcpiEndpoint(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_GENERATE_LOCAL_TOKEN);
  }

  public static canListVehicles(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLES, Constants.ACTION_LIST);
  }

  public static canReadVehicle(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_READ);
  }

  public static canCreateVehicle(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_CREATE);
  }

  public static canUpdateVehicle(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_UPDATE);
  }

  public static canDeleteVehicle(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_DELETE);
  }

  public static canListVehicleManufacturers(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURERS, Constants.ACTION_LIST);
  }

  public static canReadVehicleManufacturer(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_READ);
  }

  public static canCreateVehicleManufacturer(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_CREATE);
  }

  public static canUpdateVehicleManufacturer(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_UPDATE);
  }

  public static canDeleteVehicleManufacturer(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_DELETE);
  }

  public static canListSiteAreas(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREAS, Constants.ACTION_LIST);
  }

  public static canReadSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_READ,
      { 'site': siteID, 'sites': loggedUser.sites });
  }

  public static canCreateSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_CREATE,
      { 'site': siteID, 'sites': loggedUser.sitesAdmin });
  }

  public static canUpdateSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_UPDATE, {
      'site': siteID,
      'sites': loggedUser.sitesAdmin
    });
  }

  public static canDeleteSiteArea(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_DELETE,
      { 'site': siteID, 'sites': loggedUser.sitesAdmin });
  }

  public static canListCompanies(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANIES, Constants.ACTION_LIST);
  }

  public static canReadCompany(loggedUser: UserToken, companyId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_READ,
      { 'company': companyId, 'companies': loggedUser.companies });
  }

  public static canCreateCompany(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_CREATE);
  }

  public static canUpdateCompany(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_UPDATE);
  }

  public static canDeleteCompany(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_DELETE);
  }

  public static canListTenants(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANTS, Constants.ACTION_LIST);
  }

  public static canReadTenant(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_READ);
  }

  public static canCreateTenant(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_CREATE);
  }

  public static canUpdateTenant(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_UPDATE);
  }

  public static canDeleteTenant(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_DELETE);
  }

  public static canCreateConnection(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_CREATE);
  }

  public static canDeleteConnection(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_DELETE,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canReadConnection(loggedUser: UserToken, userId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_READ,
      { 'user': userId, 'owner': loggedUser.id });
  }

  public static canListConnections(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTIONS, Constants.ACTION_LIST);
  }

  public static canReadPricing(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING, Constants.ACTION_READ);
  }

  public static canUpdatePricing(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING, Constants.ACTION_UPDATE);
  }

  public static isSuperAdmin(user: UserToken | User): boolean {
    return user.role === Constants.ROLE_SUPER_ADMIN;
  }

  public static isAdmin(user: UserToken | User): boolean {
    return user.role === Constants.ROLE_ADMIN;
  }

  public static isSiteAdmin(user: UserToken): boolean {
    return user.role === Constants.ROLE_BASIC && user.sitesAdmin && user.sitesAdmin.length > 0;
  }

  public static isBasic(user: UserToken | User): boolean {
    return user.role === Constants.ROLE_BASIC;
  }

  public static isDemo(user: UserToken | User): boolean {
    return user.role === Constants.ROLE_DEMO;
  }

  private static async isTagIDAuthorizedOnChargingStation(tenantID: string, chargingStation: ChargingStation, transaction: Transaction, tagID: string, action: string): Promise<User> {
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
          errorCode: Constants.HTTP_AUTH_CHARGER_WITH_NO_SITE_AREA_ERROR,
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
          errorCode: Constants.HTTP_AUTH_SITE_AREA_WITH_NO_SITE_ERROR,
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
      if (user.status !== Constants.USER_STATUS_ACTIVE) {
        // Reject but save ok
        throw new AppError({
          source: chargingStation.id,
          errorCode: Constants.HTTP_GENERAL_ERROR,
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
          errorCode: Constants.HTTP_GENERAL_ERROR,
          user: userToken,
          action: action,
          entity: Constants.ENTITY_CHARGING_STATION,
          value: chargingStation.id,
          module: 'Authorizations',
          method: '_checkAndGetUserOnChargingStation',
        });
      }
    }
    return user;
  }

  private static getUserScopes(tenantID: string, user: User, sitesAdminCount: number): ReadonlyArray<string> {
    // Get the group from User's role
    const groups = Authorizations.getAuthGroupsFromUser(user.role, sitesAdminCount);
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
        status: Constants.USER_STATUS_INACTIVE,
        role: Constants.ROLE_BASIC
      } as User;
      // Save User
      user.id = await UserStorage.saveUser(tenantID, user);
      // Save User TagIDs
      await UserStorage.saveUserTags(tenantID, user.id, [tagID]);
      // Save User Status
      await UserStorage.saveUserStatus(tenantID, user.id, user.status);
      // Save User Role
      await UserStorage.saveUserRole(tenantID, user.id, user.role);
      // Save User Admin data
      await UserStorage.saveUserAdminData(tenantID, user.id, { notificationsActive: user.notificationsActive, notifications: user.notifications });
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
      );
      // Not authorized
      throw new AppError({
        source: chargingStation.id,
        errorCode: Constants.HTTP_GENERAL_ERROR,
        message: `User with Tag ID '${tagID}' not found but saved as inactive user`,
        module: 'Authorizations',
        method: 'checkAndGetUserTagIDOnChargingStation',
        user: user
      });
    } else if (user.status === Constants.USER_STATUS_DELETED) {
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
      await UserStorage.saveUserStatus(tenantID, user.id, Constants.USER_STATUS_INACTIVE);
      // Save User Role
      await UserStorage.saveUserRole(tenantID, user.id, Constants.ROLE_BASIC);
      // Save User Admin data
      await UserStorage.saveUserAdminData(tenantID, user.id, { notificationsActive: user.notificationsActive, notifications: user.notifications });
    }
    return user;
  }

  private static getConfiguration() {
    if (!Authorizations.configuration) {
      Authorizations.configuration = Configuration.getAuthorizationConfig();
    }
    return Authorizations.configuration;
  }

  private static getAuthGroupsFromUser(userRole: string, sitesAdminCount: number): ReadonlyArray<string> {
    const groups: Array<string> = [];
    switch (userRole) {
      case Constants.ROLE_ADMIN:
        groups.push('admin');
        break;
      case Constants.ROLE_SUPER_ADMIN:
        groups.push('superAdmin');
        break;
      case Constants.ROLE_BASIC:
        groups.push('basic');
        // Check Site Admin
        if (sitesAdminCount > 0) {
          groups.push('siteAdmin');
        }
        break;
      case Constants.ROLE_DEMO:
        groups.push('demo');
        break;
    }
    return groups;
  }

  private static canPerformAction(loggedUser: UserToken, resource, action, context?): boolean {
    // Get the groups
    const groups = Authorizations.getAuthGroupsFromUser(loggedUser.role,
      loggedUser.sitesAdmin ? loggedUser.sitesAdmin.length : 0);

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
