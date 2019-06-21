import Logging from '../utils/Logging';
import Constants from '../utils/Constants';
import Configuration from '../utils/Configuration';
import NotificationHandler from '../notification/NotificationHandler';
import AppError from '../exception/AppError';
import AppAuthError from '../exception/AppAuthError';
import BackendError from '../exception/BackendError';
import Utils from '../utils/Utils';
import User from '../entity/User';
import Tenant from '../entity/Tenant';
import Transaction from '../entity/Transaction';
import AuthorizationsDefinition from './AuthorizationsDefinition';
import ChargingStation from '../entity/ChargingStation';
import TenantStorage from '../storage/mongodb/TenantStorage';
import SourceMap from 'source-map-support';
SourceMap.install();

export default class Authorizations {

  private static configuration: any;

  public static canRefundTransaction(loggedUser: any, transaction: any) {
    let userId;
    if (transaction.getUserJson()) {
      userId = transaction.getUserJson().id;
    }
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
      Constants.ACTION_REFUND_TRANSACTION, {"UserID": userId});
  }

  public static canStartTransaction(user: any, chargingStation: ChargingStation) {
    // Can perform stop?
    if (!Authorizations.canPerformActionOnChargingStation(
      user.getModel(),
      chargingStation.getModel(),
      Constants.ACTION_REMOTE_START_TRANSACTION)) {
      // Ko
      return false;
    }
    // Ok
    return true;
  }

  public static canStopTransaction(user: any, chargingStation: any) {
    // Can perform stop?
    if (!Authorizations.canPerformActionOnChargingStation(
      user.getModel(),
      chargingStation.getModel(),
      Constants.ACTION_REMOTE_STOP_TRANSACTION)) {
      // Ko
      return false;
    }
    // Ok
    return true;
  }

  public static getAuthorizedEntityIDsFromLoggedUser(entityName: any, loggedUser: any) {
    switch (entityName) {
      case Constants.ENTITY_COMPANY:
        return loggedUser.companies;
      case Constants.ENTITY_SITE:
        return loggedUser.sites;
    }
  }

  public static async getAuthorizedEntities(user: User) {
    if (!Authorizations.isAdmin(user.getRole())) {
      const companyIDs = [];
      const siteIDs = [];

      const sites = await user.getSites();
      for (const site of sites) {
        siteIDs.push(site.getID());
        if (!companyIDs.includes(site.getCompanyID())) {
          companyIDs.push(site.getCompanyID());
        }
      }

      return {
        companies: companyIDs,
        sites: siteIDs
      };
    }
    return {};

  }

  private static async checkAndGetUserTagIDOnChargingStation(chargingStation: any, tagID: any, action: any) {
    // Get the user
    let user: any = await User.getUserByTagId(chargingStation.getTenantID(), tagID);
    // Found?
    if (!user) {
      // Create an empty user
      const newUser = new User(chargingStation.getTenantID(), {
        name: "Unknown",
        firstName: "User",
        status: Constants.USER_STATUS_INACTIVE,
        role: Constants.ROLE_BASIC,
        email: tagID + "@chargeangels.fr",
        tagIDs: [tagID],
        createdOn: new Date().toISOString()
      });
      // Save the user
      user = await newUser.save();
      // Notify
      NotificationHandler.sendUnknownUserBadged(
        chargingStation.getTenantID(),
        Utils.generateGUID(),
        chargingStation.getModel(),
        {
          "chargeBoxID": chargingStation.getID(),
          "badgeId": tagID,
          "evseDashboardURL": Utils.buildEvseURL((await chargingStation.getTenant()).getSubdomain()),
          "evseDashboardUserURL": await Utils.buildEvseUserURL(user, '#inerror')
        }
      );
      // Not authorized
      throw new AppError(
        chargingStation.getID(),
        `User with Tag ID '${tagID}' not found but saved as inactive user`, 500,
        "Authorizations", "_checkAndGetUserTagIDOnChargingStation", user.getModel()
      );
    } else {
      // USer Exists: Check User Deleted?
      if (user.getStatus() === Constants.USER_STATUS_DELETED) {
        // Yes: Restore it!
        user.setDeleted(false);
        // Set default user's value
        user.setStatus(Constants.USER_STATUS_INACTIVE);
        user.setName("Unknown");
        user.setFirstName("User");
        user.setEMail(tagID + "@chargeangels.fr");
        user.setPhone("");
        user.setMobile("");
        user.setNotificationsActive(true);
        user.setImage("");
        user.setINumber("");
        user.setCostCenter("");
        // Log
        Logging.logSecurityInfo({
          tenantID: user.getTenantID(), user: user,
          module: "Authorizations", method: "_checkAndGetUserTagIDOnChargingStation",
          message: `User with ID '${user.getID()}' has been restored`,
          action: action
        });
        // Save
        user = user.save();
      }
    }
    return user;
  }

  public static async getConnectorActionAuthorizations(tenantID: string, user: any, chargingStation: any, connector: any, siteArea: any, site: any) {
    const tenant: Tenant | null = await Tenant.getTenant(tenantID);
    if (!tenant) {
      throw new BackendError('Authorizations.ts#getConnectorActionAuthorizations', 'Tenant null');
    }
    const isOrgCompActive = tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
    if (isOrgCompActive && (!siteArea || !site)) {
      throw new AppError(
        chargingStation.getID(),
        `Site area and site not provided for Charging Station '${chargingStation.getID()}'!`, 500,
        "Authorizations", "getConnectorActionAuthorizations",
        user.getModel()
      );
    }
    // Set default value
    let isUserAssignedToSite = false;
    let accessControlEnable = true;
    let userAllowedToStopAllTransactions = false;
    let isSameUserAsTransaction = false;
    if (isOrgCompActive) {
      // Acces Control Enabled?
      accessControlEnable = siteArea.isAccessControlEnabled();
      // Allow to stop all transactions
      userAllowedToStopAllTransactions = site.isAllowAllUsersToStopTransactionsEnabled();
      // Check if User belongs to the charging station Site
      const foundUser = await site.getUser(user.getID());
      isUserAssignedToSite = (foundUser ? true : false);
    }
    if (connector.activeTransactionID > 0) {
      // Get Transaction
      const transaction = await Transaction.getTransaction(tenantID, connector.activeTransactionID);
      if (!transaction) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Transaction ID '${connector.activeTransactionID}' does not exist`,
          560, 'Authorizations', 'getConnectorActionAuthorizations');
      }
      // Check if transaction user is the same as request user
      isSameUserAsTransaction = transaction.getUserID() === user.getID();
    }

    // Prepare default authorizations
    const result = {
      'isStartAuthorized': Authorizations.canStartTransaction(user, chargingStation),
      'isStopAuthorized': Authorizations.canStopTransaction(user, chargingStation),
      'isTransactionDisplayAuthorized': false
    };
    if (user.getRole() === Constants.ROLE_ADMIN) {
      // An admin has all authorizations except for site where he is not assigned and in case site management is not active
      const defaultAuthorization = (isOrgCompActive && isUserAssignedToSite) || (!isOrgCompActive);
      result.isStartAuthorized = result.isStartAuthorized && defaultAuthorization;
      result.isStopAuthorized = result.isStopAuthorized && defaultAuthorization;
      result.isTransactionDisplayAuthorized = defaultAuthorization;
    }
    if (user.getRole() === Constants.ROLE_DEMO) {
      // Demon user can never start nor stop transaction and can display details only for assigned site
      const defaultAuthorization = (isOrgCompActive && isUserAssignedToSite) || (!isOrgCompActive);
      result.isStartAuthorized = false;
      result.isStopAuthorized = false;
      result.isTransactionDisplayAuthorized = defaultAuthorization;
    }
    if (user.getRole() === Constants.ROLE_BASIC) {
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

  public static async isTagIDAuthorizedOnChargingStation(chargingStation: ChargingStation, tagID: string, action: string): Promise<User> {
    let site, siteArea;
    // Get the Organization component
    const tenant = await TenantStorage.getTenant(chargingStation.getTenantID());
    const isOrgCompActive = await tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
    // Org component enabled?
    if (isOrgCompActive) {
      // Site Area -----------------------------------------------
      siteArea = await chargingStation.getSiteArea();
      // Site is mandatory
      if (!siteArea) {
        // Reject Site Not Found
        throw new AppError(
          chargingStation.getID(),
          `Charging Station '${chargingStation.getID()}' is not assigned to a Site Area!`, 525,
          "Authorizations", "_checkAndGetUserOnChargingStation");
      }
      // Access Control Enabled?
      if (!siteArea.isAccessControlEnabled()) {
        // No control
        return;
      }
      // Site -----------------------------------------------------
      site = await siteArea.getSite();
      if (!site) {
        // Reject Site Not Found
        throw new AppError(
          chargingStation.getID(),
          `Site Area '${siteArea.getName()}' is not assigned to a Site!`, 525,
          "Authorizations", "checkAndGetUserOnChargingStation");
      }
    }
    // Get user
    let user = null;
    // Get the user
    if (tagID) {
      user = await Authorizations.checkAndGetUserTagIDOnChargingStation(
        chargingStation, tagID, action);
    }
    // Found?
    if (user) {
      // Check Authorization
      await Authorizations._checkAndGetUserOnChargingStation(
        chargingStation, user, isOrgCompActive, site, action);
    }
    return user;
  }

  public static async isTagIDsAuthorizedOnChargingStation(chargingStation: ChargingStation, tagId: any, transactionTagId: any, action: any) {
    let user: any, alternateUser: any;
    // Check if same user
    if (tagId !== transactionTagId) {
      // No: Check alternate user
      alternateUser = await Authorizations.isTagIDAuthorizedOnChargingStation(
        chargingStation, tagId, action);
      // Anonymous?
      if (alternateUser) {
        // Get the user
        user = await User.getUserByTagId(chargingStation.getTenantID(), transactionTagId);
        // Not Check if Alternate User belongs to a Site --------------------------------
        // Organization component active?
        const tenant = await TenantStorage.getTenant(chargingStation.getTenantID());
        const isOrgCompActive = await tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
        if (isOrgCompActive) {
          // Get the site (site existence is already checked by isTagIDAuthorizedOnChargingStation())
          const site = await chargingStation.getSite();
          // Check if the site allows to stop the transaction of another user
          if (!Authorizations.isAdmin(alternateUser.getRole()) &&
            !site.isAllowAllUsersToStopTransactionsEnabled()) {
            // Reject the User
            throw new BackendError(
              chargingStation.getID(),
              `User '${alternateUser.getFullName()}' is not allowed to perform 'Stop Transaction' on User '${user.getFullName()}' on Site '${site.getName()}'!`,
              'Authorizations', "isTagIDsAuthorizedOnChargingStation", action,
              (alternateUser ? alternateUser.getModel() : null), (user ? user.getModel() : null));
          }
        } else {
          // Only Admins can stop a transaction when org is not active
          if (!Authorizations.isAdmin(alternateUser.getRole())) {
            // Reject the User
            throw new BackendError(
              chargingStation.getID(),
              `User '${alternateUser.getFullName()}' is not allowed to perform 'Stop Transaction' on User '${user.getFullName()}'!`,
              'Authorizations', "isTagIDsAuthorizedOnChargingStation", action,
              (alternateUser ? alternateUser.getModel() : null), (user ? user.getModel() : null));
          }
        }
      }
    } else {
      // Check user
      user = await Authorizations.isTagIDAuthorizedOnChargingStation(
        chargingStation, transactionTagId, action);
    }
    return {user, alternateUser};
  }

  public static async _checkAndGetUserOnChargingStation(chargingStation: any, user: any, isOrgCompActive: boolean, site: any, action: string) {
    // Check User status
    if (user.getStatus() !== Constants.USER_STATUS_ACTIVE) {
      // Reject but save ok
      throw new AppError(
        chargingStation.getID(),
        `${Utils.buildUserFullName(user.getModel())} is '${User.getStatusDescription(user.getStatus())}'`, 500,
        "Authorizations", "_checkAndGetUserOnChargingStation",
        user.getModel());
    }

    // Check if User belongs to a Site ------------------------------------------
    // Org component enabled?
    if (isOrgCompActive) {
      const foundUser = await site.getUser(user.getID());
      // User not found and Access Control Enabled?
      if (!foundUser) {
        // Yes: Reject the User
        throw new AppError(
          chargingStation.getID(),
          `User is not assigned to the site '${site.getName()}'!`, 525,
          "Authorizations", "_checkAndGetUserOnChargingStation",
          user.getModel());
      }
    }
    // Authorized?
    if (!Authorizations.canPerformActionOnChargingStation(user.getModel(), chargingStation.getModel(), action)) {
      // Not Authorized!
      throw new AppAuthError(
        action,
        Constants.ENTITY_CHARGING_STATION,
        chargingStation.getID(),
        500, "Authorizations", "_checkAndGetUserOnChargingStation",
        user.getModel());
    }
  }

  public static canListLogging(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGINGS, Constants.ACTION_LIST);
  }

  public static canReadLogging(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGING, Constants.ACTION_READ);
  }

  public static canListTransactions(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS, Constants.ACTION_LIST);
  }

  public static canListTransactionsInError(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS, Constants.ACTION_LIST);
  }

  public static canReadTransaction(loggedUser: any, transaction: Transaction): boolean {
    if (transaction.getUserJson() && transaction.getUserJson().id) {
      return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_READ,
        {"user": transaction.getUserJson().id, "owner": loggedUser.id});
    }
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_READ);
  }

  public static canUpdateTransaction(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_UPDATE);
  }

  public static canDeleteTransaction(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_DELETE);
  }

  public static canListChargingStations(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATIONS, Constants.ACTION_LIST);
  }

  public static canPerformActionOnChargingStation(loggedUser: any, chargingStation: any, action: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, action);
  }

  public static canReadChargingStation(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_READ);
  }

  public static canUpdateChargingStation(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_UPDATE);
  }

  public static canDeleteChargingStation(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_DELETE);
  }

  public static canListUsers(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USERS, Constants.ACTION_LIST);
  }

  public static canReadUser(loggedUser: any, user: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_READ,
      {"user": user.id.toString(), "owner": loggedUser.id});
  }

  public static canCreateUser(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_CREATE);
  }

  public static canUpdateUser(loggedUser: any, user: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_UPDATE,
      {"user": user.id.toString(), "owner": loggedUser.id});
  }

  public static canDeleteUser(loggedUser: any, user: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_DELETE,
      {"user": user.id.toString(), "owner": loggedUser.id});
  }

  public static canListSites(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITES, Constants.ACTION_LIST);
  }

  public static canReadSite(loggedUser: any, site: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_READ,
      {"site": site.id.toString(), "sites": loggedUser.sites});
  }

  public static canCreateSite(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_CREATE);
  }

  public static canUpdateSite(loggedUser: any, siteID: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_UPDATE);
  }

  public static canDeleteSite(loggedUser: any, siteID: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_DELETE);
  }

  public static canListSettings(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTINGS, Constants.ACTION_LIST);
  }

  public static canReadSetting(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_READ);
  }

  public static canDeleteSetting(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_DELETE);
  }

  public static canCreateSetting(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_CREATE);
  }

  public static canUpdateSetting(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_UPDATE);
  }

  public static canListOcpiEndpoints(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINTS, Constants.ACTION_LIST);
  }

  public static canReadOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_READ);
  }

  public static canDeleteOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_DELETE);
  }

  public static canCreateOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_CREATE);
  }

  public static canUpdateOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_UPDATE);
  }

  public static canPingOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_PING);
  }

  public static canSendEVSEStatusesOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_SEND_EVSE_STATUSES);
  }

  public static canRegisterOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_REGISTER);
  }

  public static canGenerateLocalTokenOcpiEndpoint(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_GENERATE_LOCAL_TOKEN);
  }

  public static canListVehicles(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLES, Constants.ACTION_LIST);
  }

  public static canReadVehicle(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_READ);
  }

  public static canCreateVehicle(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_CREATE);
  }

  public static canUpdateVehicle(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_UPDATE);
  }

  public static canDeleteVehicle(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_DELETE);
  }

  public static canListVehicleManufacturers(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURERS, Constants.ACTION_LIST);
  }

  public static canReadVehicleManufacturer(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_READ);
  }

  public static canCreateVehicleManufacturer(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_CREATE);
  }

  public static canUpdateVehicleManufacturer(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_UPDATE);
  }

  public static canDeleteVehicleManufacturer(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_DELETE);
  }

  public static canListSiteAreas(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREAS, Constants.ACTION_LIST);
  }

  public static canReadSiteArea(loggedUser: any, siteArea: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_READ) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_READ,
        {"site": siteArea.siteID, "sites": loggedUser.sites});
  }

  public static canCreateSiteArea(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_CREATE) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_CREATE);
  }

  public static canUpdateSiteArea(loggedUser: any, siteArea: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_UPDATE) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_UPDATE);
  }

  public static canDeleteSiteArea(loggedUser: any, siteArea: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_DELETE) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_DELETE);
  }

  public static canListCompanies(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANIES, Constants.ACTION_LIST);
  }

  public static canReadCompany(loggedUser: any, companyId: string): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_READ,
      {"company": companyId, "companies": loggedUser.companies});
  }

  public static canCreateCompany(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_CREATE);
  }

  public static canUpdateCompany(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_UPDATE);
  }

  public static canDeleteCompany(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_DELETE);
  }

  public static canListTenants(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANTS, Constants.ACTION_LIST);
  }

  public static canReadTenant(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_READ);
  }

  public static canCreateTenant(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_CREATE);
  }

  public static canUpdateTenant(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_UPDATE);
  }

  public static canDeleteTenant(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_DELETE);
  }

  public static canCreateConnection(loggedUser): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_CREATE,
      {"owner": loggedUser.id});
  }

  public static canDeleteConnection(loggedUser, connection): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_DELETE,
      {"user": connection.userId.toString(), "owner": loggedUser.id});
  }

  public static canReadConnection(loggedUser, connection): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_READ,
      {"user": connection.userId.toString(), "owner": loggedUser.id});
  }

  public static canListConnections(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTIONS, Constants.ACTION_LIST);
  }

  public static canReadPricing(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING, Constants.ACTION_READ);
  }

  public static canUpdatePricing(loggedUser: any): boolean {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING, Constants.ACTION_UPDATE);
  }

  public static isSuperAdmin(userRole: string): boolean {
    return userRole === Constants.ROLE_SUPER_ADMIN;
  }

  public static isAdmin(userRole: string): boolean {
    return userRole === Constants.ROLE_ADMIN;
  }

  public static isBasic(userRole: string): boolean {
    return userRole === Constants.ROLE_BASIC;
  }

  public static isDemo(userRole: string): boolean {
    return userRole === Constants.ROLE_DEMO;
  }

  private static getConfiguration() {
    if (!this.configuration) {
      // Load it
      this.configuration = Configuration.getAuthorizationConfig();
    }
    return this.configuration;
  }

  public static async getUserScopes(user: User): Promise<ReadonlyArray<string>> {
    const groups = Authorizations.getAuthGroupsFromUser(user.getRole(), await user.getSites());
    return AuthorizationsDefinition.getInstance().getScopes(groups);
  }

  private static getAuthGroupsFromUser(userRole: string, sitesAdmin: ReadonlyArray<string>): ReadonlyArray<string> {
    const roles: Array<string> = [];
    switch (userRole) {
      case 'A':
        roles.push('admin');
        break;
      case 'S':
        roles.push('superAdmin');
        break;
      case 'B':
        roles.push('basic');
        break;
      case 'D':
        roles.push('demo');
        break;
    }
    if (sitesAdmin && sitesAdmin.length > 0) {
      roles.push('siteAdmin');
    }
    return roles;
  }

  private static canPerformAction(loggedUser, resource, action, context?): boolean {
    const roles = Authorizations.getAuthGroupsFromUser(loggedUser.role, loggedUser.sitesAdmin);
    const authorized = AuthorizationsDefinition.getInstance().can(roles, resource, action, context);
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
