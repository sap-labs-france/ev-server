import AppAuthError from '../exception/AppAuthError';
import AppError from '../exception/AppError';
import AuthorizationsDefinition from './AuthorizationsDefinition';
import BackendError from '../exception/BackendError';
import ChargingStation from '../types/ChargingStation';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import NotificationHandler from '../notification/NotificationHandler';
import SessionHashService from '../server/rest/service/SessionHashService';
import Site from '../types/Site';
import SiteArea from '../types/SiteArea';
import SiteStorage from '../storage/mongodb/SiteStorage';
import Tenant from '../entity/Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Transaction from '../entity/Transaction';
import User from '../types/User';
import UserStorage from '../storage/mongodb/UserStorage';
import UserToken from '../types/UserToken';
import Utils from '../utils/Utils';
import Connector from '../types/Connector';
import SiteAreaStorage from '../storage/mongodb/SiteAreaStorage';
import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';

export default class Authorizations {

  private static configuration: any;

  public static canRefundTransaction(loggedUser: UserToken, transaction: any) {
    let userId;
    if (transaction.getUserJson()) {
      userId = transaction.getUserJson().id;
    }
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
      Constants.ACTION_REFUND_TRANSACTION, { 'UserID': userId });
  }

  public static canStartTransaction(user: UserToken, chargingStation: ChargingStation) {
    return Authorizations.canPerformActionOnChargingStation(
      user,
      Constants.ACTION_REMOTE_START_TRANSACTION);
  }

  public static canStopTransaction(user: UserToken, chargingStation: ChargingStation) {
    return Authorizations.canPerformActionOnChargingStation(
      user,
      Constants.ACTION_REMOTE_STOP_TRANSACTION);
  }

  public static getAuthorizedCompanyIDs(loggedUser: UserToken): string[] {
    return loggedUser.companies;
  }

  public static getAuthorizedSiteIDs(loggedUser: UserToken): string[] {
    return loggedUser.sites;
  }

  public static getAuthorizedSiteAdminIDs(loggedUser: UserToken): string[] {
    return loggedUser.sitesAdmin;
  }

  public static async buildUserToken(tenantID: string, user: User): Promise<UserToken> {
    let companyIDs = [];
    let siteIDs = [];
    let siteAdminIDs = [];
    if (!Authorizations.isAdmin(user.role)) {
      // Get User's site
      const sites = (await UserStorage.getSites(tenantID, { userID: user.id },
        Constants.DB_PARAMS_MAX_LIMIT))
        .result.map((siteUser) => {
          return siteUser.site;
        });
      // Get User's Site Admin
      const sitesAdmin = await UserStorage.getSites(
        tenantID, { userID: user.id, siteAdmin: true },
        Constants.DB_PARAMS_MAX_LIMIT,
        ['site.id']
      );
      // Assign
      siteIDs = sites.map((site) => {
        return site.id;
      });
      companyIDs = [...new Set(sites.map((site) => {
        return site.companyID;
      }))];
      siteAdminIDs = sitesAdmin.result.map((siteUser) => {
        return siteUser.site.id;
      });
    }

    let tenantHashID = Constants.DEFAULT_TENANT;
    let activeComponents = [];
    if (tenantID !== Constants.DEFAULT_TENANT) {
      const tenant = await TenantStorage.getTenant(tenantID);
      tenantHashID = SessionHashService.buildTenantHashID(tenant);
      activeComponents = tenant.getActiveComponents();
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
      'userHashID': SessionHashService.buildUserHashID(user),
      'tenantHashID': tenantHashID,
      'scopes': Authorizations.getUserScopes(tenantID, user, siteAdminIDs.length),
      'companies': companyIDs,
      'sitesAdmin': siteAdminIDs,
      'sites': siteIDs,
      'activeComponents': activeComponents
    };
  }

  public static async getConnectorActionAuthorizations(params: { tenantID: string; user: UserToken; chargingStation: ChargingStation; connector: Connector; siteArea: SiteArea; site: Site }) {
    const tenant: Tenant | null = await Tenant.getTenant(params.tenantID);
    if (!tenant) {
      throw new BackendError('Authorizations.ts#getConnectorActionAuthorizations', 'Tenant null');
    }
    const isOrgCompActive = Utils.isComponentActiveFromToken(params.user, Constants.COMPONENTS.ORGANIZATION);
    if (isOrgCompActive && (!params.siteArea || !params.site)) {
      throw new AppError(
        params.chargingStation.id,
        `Site area and site not provided for Charging Station '${params.chargingStation.id}'!`, Constants.HTTP_GENERAL_ERROR,
        'Authorizations', 'getConnectorActionAuthorizations',
        params.user
      );
    }
    // Set default value
    let isUserAssignedToSite = false;
    let accessControlEnable = true;
    let userAllowedToStopAllTransactions = false;
    let isSameUserAsTransaction = false;
    if (isOrgCompActive) {
      // Acces Control Enabled?
      accessControlEnable = params.siteArea.accessControl;
      // Allow to stop all transactions
      userAllowedToStopAllTransactions = params.site.allowAllUsersToStopTransactions;
      // Check if User belongs to the charging station Site
      isUserAssignedToSite = await SiteStorage.siteHasUser(params.tenantID, params.site.id, params.user.id);
    }
    if (params.connector.activeTransactionID > 0) {
      // Get Transaction
      const transaction = await Transaction.getTransaction(params.tenantID, params.connector.activeTransactionID);
      if (!transaction) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Transaction ID '${params.connector.activeTransactionID}' does not exist`,
          Constants.HTTP_AUTH_ERROR, 'Authorizations', 'getConnectorActionAuthorizations');
      }
      // Check if transaction user is the same as request user
      isSameUserAsTransaction = transaction.getUserID() === params.user.id;
    }

    // Prepare default authorizations
    const result = {
      'isStartAuthorized': Authorizations.canStartTransaction(params.user, params.chargingStation),
      'isStopAuthorized': Authorizations.canStopTransaction(params.user, params.chargingStation),
      'isTransactionDisplayAuthorized': false
    };
    if (params.user.role === Constants.ROLE_ADMIN) {
      // An admin has all authorizations except for site where he is not assigned and in case site management is not active
      const defaultAuthorization = (isOrgCompActive && isUserAssignedToSite) || (!isOrgCompActive);
      result.isStartAuthorized = result.isStartAuthorized && defaultAuthorization;
      result.isStopAuthorized = result.isStopAuthorized && defaultAuthorization;
      result.isTransactionDisplayAuthorized = defaultAuthorization;
    }
    if (params.user.role === Constants.ROLE_DEMO) {
      // Demon user can never start nor stop transaction and can display details only for assigned site
      const defaultAuthorization = (isOrgCompActive && isUserAssignedToSite) || (!isOrgCompActive);
      result.isStartAuthorized = false;
      result.isStopAuthorized = false;
      result.isTransactionDisplayAuthorized = defaultAuthorization;
    }
    if (params.user.role === Constants.ROLE_BASIC) {
      // Basic user can start a transaction if he is assigned to the site or site management is not active
      result.isStartAuthorized = result.isStartAuthorized &&
        (isOrgCompActive && isUserAssignedToSite) || (!isOrgCompActive);
      // Basic user can start a transaction if he is assigned to the site or site management is not active
      result.isStopAuthorized = result.isStopAuthorized &&
        // Site Management is active  and user assigned to site and anyone allowed to stop or same user as transaction
        // Or access control disable
        (isOrgCompActive && isUserAssignedToSite &&
          (userAllowedToStopAllTransactions || isSameUserAsTransaction || !accessControlEnable)) ||
        // Site management inactive and badge access control and user identical to transaction
        (!isOrgCompActive && accessControlEnable && isSameUserAsTransaction) ||
        // Site management inactive and no badge access control
        (!isOrgCompActive && !accessControlEnable);
      result.isTransactionDisplayAuthorized =
        // Site Management is active  and user assigned to site and same user as transaction
        // Or access control disable
        (isOrgCompActive && isUserAssignedToSite &&
          (isSameUserAsTransaction || !accessControlEnable)) ||
        // Site management inactive and badge access control and user identical to transaction
        (!isOrgCompActive && accessControlEnable && isSameUserAsTransaction) ||
        // Site management inactive and no badge access control
        (!isOrgCompActive && !accessControlEnable);
    }
    return result;
  }

  public static async isTagIDAuthorizedOnChargingStation(tenantID: string, chargingStation: ChargingStation, tagID: string, action: string) {
    // Get the Organization component
    const tenant = await TenantStorage.getTenant(tenantID);
    const isOrgCompActive = tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
    // Org component enabled?
    if (isOrgCompActive) {
      let foundSiteArea = true;
      // Site Area -----------------------------------------------
      if(! chargingStation.siteAreaID) {
        foundSiteArea = false;
      } else {
        if(! chargingStation.siteArea) {
          chargingStation.siteArea =
            await SiteAreaStorage.getSiteArea(tenantID, chargingStation.siteAreaID, {withSite: true});
          if(! chargingStation.siteArea) {
            foundSiteArea = false;
          }
        }
      }
      // Site is mandatory
      if (! foundSiteArea) {
        // Reject Site Not Found
        throw new AppError(
          chargingStation.id,
          `Charging Station '${chargingStation.id}' is not assigned to a Site Area!`,
          Constants.HTTP_AUTH_CHARGER_WITH_NO_SITE_AREA_ERROR,
          'Authorizations', '_checkAndGetUserOnChargingStation');
      }

      // Access Control Enabled?
      if (!chargingStation.siteArea.accessControl) {
        // No control
        return;
      }
      // Site -----------------------------------------------------
      // TODO: consider changing structure of CS->SA->S entirely; It's a little inconvenient that sometimes CS includes SA with includes S, which can also include SA, but not always
      chargingStation.siteArea.site = chargingStation.siteArea.site ? chargingStation.siteArea.site : (chargingStation.siteArea.siteID ? await SiteStorage.getSite(tenantID, chargingStation.siteArea.siteID) : null);
      if (!chargingStation.siteArea.site) {
        // Reject Site Not Found
        throw new AppError(
          chargingStation.id,
          `Site Area '${chargingStation.siteArea.name}' is not assigned to a Site!`,
          Constants.HTTP_AUTH_SITE_AREA_WITH_NO_SITE_ERROR,
          'Authorizations', 'checkAndGetUserOnChargingStation');
      }
    }
    // Get user
    let user: User = null;
    // Get the user
    if (tagID) {
      user = await Authorizations.checkAndGetUserTagIDOnChargingStation(tenantID,
        chargingStation, tagID, action);
    }
    // Found?
    if (user) {
      // Check Authorization
      // Check User status
      if (user.status !== Constants.USER_STATUS_ACTIVE) {
        // Reject but save ok
        throw new AppError(
          chargingStation.id,
          `${Utils.buildUserFullName(user)} is '${Utils.getStatusDescription(user.status)}'`, Constants.HTTP_GENERAL_ERROR,
          'Authorizations', '_checkAndGetUserOnChargingStation',
          user);
      }

      const userToken = await Authorizations.buildUserToken(tenantID, user);
      await Authorizations._checkAndGetUserOnChargingStation(tenantID,
        chargingStation, userToken, isOrgCompActive, chargingStation.siteArea.site, action);
    }
    return user;
  }

  public static async isTagIDsAuthorizedOnChargingStation(tenantID: string, chargingStation: ChargingStation, tagId: string, transactionTagId: string, action: string) {
    let user: User, alternateUser: User;
    // Check if same user
    if (tagId !== transactionTagId) {
      // No: Check alternate user
      alternateUser = await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, tagId, action);
      // Anonymous?
      if (alternateUser) {
        // Get the user
        user = await UserStorage.getUserByTagId(tenantID, transactionTagId);
        if (user.id !== alternateUser.id) {
          // Not Check if Alternate User belongs to a Site --------------------------------
          // Organization component active?
          const tenant = await TenantStorage.getTenant(tenantID);
          const isOrgCompActive = tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
          if (isOrgCompActive) {
            // Get the site (site existence is already checked by isTagIDAuthorizedOnChargingStation())
            const site: Site = chargingStation.siteArea.site;
            // Check if the site allows to stop the transaction of another user
            if (!Authorizations.isAdmin(alternateUser.role) &&
              !site.allowAllUsersToStopTransactions) {
              // Reject the User
              throw new BackendError(
                chargingStation.id,
                `User '${Utils.buildUserFullName(alternateUser)}' is not allowed to perform 'Stop Transaction' on User '${Utils.buildUserFullName(user)}' on Site '${site.name}'!`,
                'Authorizations', 'isTagIDsAuthorizedOnChargingStation', action,
                (alternateUser ? alternateUser : null), (user ? user : null));
            }
          } else {
            // Only Admins can stop a transaction when org is not active
            if (!Authorizations.isAdmin(alternateUser.role)) {
              // Reject the User
              throw new BackendError(
                chargingStation.id,
                `User '${Utils.buildUserFullName(alternateUser)}' is not allowed to perform 'Stop Transaction' on User '${Utils.buildUserFullName(user)}'!`,
                'Authorizations', 'isTagIDsAuthorizedOnChargingStation', action,
                (alternateUser ? alternateUser : null), (user ? user : null));
            }
          }
        }
      }
    } else {
      // Check user
      user = await Authorizations.isTagIDAuthorizedOnChargingStation(tenantID, chargingStation, transactionTagId, action);
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
    const context = {
      user: transaction.getUserJson() ? transaction.getUserJson().id : null,
      owner: loggedUser.id,
      site: transaction.getSiteID(),
      sites: loggedUser.sitesAdmin
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

  public static canPerformActionOnChargingStation(loggedUser: UserToken, action: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, action);
  }

  public static canReadChargingStation(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_READ);
  }

  public static canUpdateChargingStation(loggedUser: UserToken, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_UPDATE, {
      'site': siteID,
      'sites': loggedUser.sitesAdmin
    });
  }

  public static canDeleteChargingStation(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_DELETE);
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

  public static canReadSetting(loggedUser: UserToken): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_READ);
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
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_CREATE,
      { 'owner': loggedUser.id });
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

  public static isSuperAdmin(userRole: string): boolean {
    return userRole === Constants.ROLE_SUPER_ADMIN;
  }

  public static isAdmin(userRole: string): boolean {
    return userRole === Constants.ROLE_ADMIN;
  }

  public static isSiteAdmin(loggedUser: UserToken): boolean {
    return loggedUser.role === Constants.ROLE_BASIC && loggedUser.sitesAdmin && loggedUser.sitesAdmin.length > 0;
  }

  public static isBasic(userRole: string): boolean {
    return userRole === Constants.ROLE_BASIC;
  }

  public static isDemo(userRole: string): boolean {
    return userRole === Constants.ROLE_DEMO;
  }

  private static async _checkAndGetUserOnChargingStation(tenantID: string, chargingStation: ChargingStation, loggedUser: UserToken, isOrgCompActive: boolean, site: Site, action: string) {
    // Check if User belongs to a Site ------------------------------------------
    // Org component enabled?
    if (isOrgCompActive) {
      const foundUser = await SiteStorage.siteHasUser(tenantID, site.id, loggedUser.id);
      // User not found and Access Control Enabled?
      if (!foundUser) {
        // Yes: Reject the User
        throw new AppError(
          chargingStation.id,
          `User is not assigned to the site '${site.name}'!`,
          Constants.HTTP_AUTH_USER_WITH_NO_SITE_ERROR,
          'Authorizations', '_checkAndGetUserOnChargingStation',
          loggedUser);
      }
    }
    // Authorized?
    if (!Authorizations.canPerformActionOnChargingStation(loggedUser, action)) {
      // Not Authorized!
      throw new AppAuthError(
        action,
        Constants.ENTITY_CHARGING_STATION,
        chargingStation.id,
        Constants.HTTP_GENERAL_ERROR, 'Authorizations', '_checkAndGetUserOnChargingStation',
        loggedUser);
    }
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
        name: 'Unknown',
        firstName: 'User',
        status: Constants.USER_STATUS_INACTIVE,
        role: Constants.ROLE_BASIC,
        email: tagID + '@chargeangels.fr',
        tagIDs: [tagID],
        ...UserStorage.getEmptyUser()
      };
      await UserStorage.saveUser(tenantID, user);

      // Notify
      NotificationHandler.sendUnknownUserBadged(
        tenantID,
        Utils.generateGUID(),
        chargingStation,
        {
          'chargeBoxID': chargingStation.id,
          'badgeId': tagID,
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(tenantID)).getSubdomain()),
          'evseDashboardUserURL': await Utils.buildEvseUserURL(tenantID, user, '#inerror')
        }
      );
      // Not authorized
      throw new AppError(
        chargingStation.id,
        `User with Tag ID '${tagID}' not found but saved as inactive user`, Constants.HTTP_GENERAL_ERROR,
        'Authorizations', '_checkAndGetUserTagIDOnChargingStation', user
      );
    } else if (user.status === Constants.USER_STATUS_DELETED) {
      // Yes: Restore it!
      user.deleted = false;
      // Set default user's value
      user.status = Constants.USER_STATUS_INACTIVE;
      user.name = 'Unknown';
      user.firstName = 'User';
      user.email = tagID + '@chargeangels.fr';
      user.phone = '';
      user.mobile = '';
      user.notificationsActive = true;
      user.image = '';
      user.iNumber = '';
      user.costCenter = '';
      // Log
      Logging.logSecurityInfo({
        tenantID: tenantID, user: user,
        module: 'Authorizations', method: '_checkAndGetUserTagIDOnChargingStation',
        message: `User with ID '${user.id}' has been restored`,
        action: action
      });
      // Save
      await UserStorage.saveUser(tenantID, user);
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
