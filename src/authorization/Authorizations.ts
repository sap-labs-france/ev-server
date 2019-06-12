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
import AccessControl from 'role-acl';
import AuthorizationsDefinition from './AuthorizationsDefinition';
import ChargingStation from '../entity/ChargingStation';
import TenantStorage from '../storage/mongodb/TenantStorage';
import SourceMap from 'source-map-support';
import Company from '../types/Company';
SourceMap.install();

export default class Authorizations {

  private static configuration: any;
  private static accessControl = new AccessControl(AuthorizationsDefinition.getGrants());

  static canRefundTransaction(loggedUser: any, transaction: any) {
    // Check auth
    if (transaction.getUserJson()) {
      // Check
      return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
        Constants.ACTION_REFUND_TRANSACTION, { "UserID": transaction.getUserJson().id.toString() });
      // Admin?
    } else if (!Authorizations.isAdmin(loggedUser)) {
      return false;
    }
    return true;
  }

  static canStartTransaction(user: any, chargingStation: any) {
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

  static canStopTransaction(user: any, chargingStation: any) {
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

  static getAuthorizedEntityIDsFromLoggedUser(entityName: any, loggedUser: any) {
    switch (entityName) {
      case Constants.ENTITY_COMPANY:
        return loggedUser.companies;
      case Constants.ENTITY_SITE:
        return loggedUser.sites;
    }
  }

  static async getAuthorizedEntities(user) {
    if (!Authorizations.isAdmin(user.getModel())) {
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
    } else {
      return {};
    }
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

  static async getConnectorActionAuthorizations(tenantID: string, user: any, chargingStation: any, connector: any, siteArea: any, site: any) {
    const tenant: Tenant|null = await Tenant.getTenant(tenantID);
    if(tenant == null) {
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
    // set default value
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
        // or access control disable
        (isOrgCompActive && isUserAssignedToSite &&
          (userAllowedToStopAllTransactions || isSameUserAsTransaction || !accessControlEnable)) ||
        // Site management inactive and badge access control and user identical to transaction
        (!isOrgCompActive && accessControlEnable && isSameUserAsTransaction) ||
        // Site management inactive and no badge access control
        (!isOrgCompActive && !accessControlEnable);
      result.isTransactionDisplayAuthorized =
        // Site Management is active  and user assigned to site and same user as transaction
        // or access control disable
        (isOrgCompActive && isUserAssignedToSite &&
          (isSameUserAsTransaction || !accessControlEnable)) ||
        // Site management inactive and badge access control and user identical to transaction
        (!isOrgCompActive && accessControlEnable && isSameUserAsTransaction) ||
        // Site management inactive and no badge access control
        (!isOrgCompActive && !accessControlEnable);
    }
    return result;
  }

  static async isTagIDAuthorizedOnChargingStation(chargingStation: ChargingStation, tagID: any, action: any) {
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

  static async isTagIDsAuthorizedOnChargingStation(chargingStation: ChargingStation, tagId: any, transactionTagId: any, action: any) {
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
          if (!Authorizations.isAdmin(alternateUser.getModel()) &&
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
          if (!Authorizations.isAdmin(alternateUser.getModel())) {
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
    return { user, alternateUser };
  }

  static async _checkAndGetUserOnChargingStation(chargingStation: any, user: any, isOrgCompActive: boolean, site: any, action: string) {
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

  static canListLogging(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGINGS, Constants.ACTION_LIST);
  }

  static canReadLogging(loggedUser: any, logging: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGING, Constants.ACTION_READ);
  }

  static canListTransactions(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS, Constants.ACTION_LIST);
  }

  static canListTransactionsInError(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS, Constants.ACTION_LIST);
  }

  static canReadTransaction(loggedUser: any, transaction: any) {
    // Check auth
    if (transaction.getUserJson() && transaction.getUserJson().id) {
      return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_READ,
        {"user": transaction.getUserJson().id.toString(), "owner": loggedUser.id});
    }
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_READ);
  }

  static canUpdateTransaction(loggedUser: any, transaction: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_UPDATE);
  }

  static canDeleteTransaction(loggedUser: any, transaction: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION, Constants.ACTION_DELETE);
  }

  static canListChargingStations(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATIONS, Constants.ACTION_LIST);
  }

  static canPerformActionOnChargingStation(loggedUser: any, chargingStation: any, action: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, action);
  }

  static canReadChargingStation(loggedUser: any, chargingStation: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_READ);
  }

  static canUpdateChargingStation(loggedUser: any, chargingStation: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_UPDATE);
  }

  static canDeleteChargingStation(loggedUser: any, chargingStation: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION, Constants.ACTION_DELETE);
  }

  static canListUsers(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USERS, Constants.ACTION_LIST);
  }

  static canReadUser(loggedUser: any, user: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_READ,
      {"user": user.id.toString(), "owner": loggedUser.id});
  }

  static canLogoutUser(loggedUser: any, user: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_CREATE);
  }

  static canCreateUser(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_CREATE);
  }

  static canUpdateUser(loggedUser: any, user: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_UPDATE,
      {"user": user.id.toString(), "owner": loggedUser.id});
  }

  static canDeleteUser(loggedUser: any, user: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER, Constants.ACTION_DELETE,
      {"user": user.id.toString(), "owner": loggedUser.id});
  }

  static canListSites(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITES, Constants.ACTION_LIST);
  }

  static canReadSite(loggedUser: any, site: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_READ,
      {"site": site.id.toString(), "sites": loggedUser.sites});
  }

  static canCreateSite(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_CREATE);
  }

  static canUpdateSite(loggedUser: any, site: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_UPDATE);
  }

  static canDeleteSite(loggedUser: any, site: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_DELETE);
  }

  static canListSettings(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTINGS, Constants.ACTION_LIST);
  }

  static canReadSetting(loggedUser: any, setting: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_READ);
  }

  static canDeleteSetting(loggedUser: any, setting: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_DELETE);
  }

  static canCreateSetting(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_CREATE);
  }

  static canUpdateSetting(loggedUser: any, setting: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING, Constants.ACTION_UPDATE);
  }

  static canListOcpiEndpoints(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINTS, Constants.ACTION_LIST);
  }

  static canReadOcpiEndpoint(loggedUser: any, ocpiendpoint: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_READ);
  }

  static canDeleteOcpiEndpoint(loggedUser: any, ocpiendpoint: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_DELETE);
  }

  static canCreateOcpiEndpoint(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_CREATE);
  }

  static canUpdateOcpiEndpoint(loggedUser: any, ocpiendpoint: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_UPDATE);
  }

  static canPingOcpiEndpoint(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_PING);
  }

  static canSendEVSEStatusesOcpiEndpoint(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_SEND_EVSE_STATUSES);
  }

  static canRegisterOcpiEndpoint(loggedUser: any, ocpiendpoint: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_REGISTER);
  }

  static canGenerateLocalTokenOcpiEndpoint(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT, Constants.ACTION_GENERATE_LOCAL_TOKEN);
  }

  static canListVehicles(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLES, Constants.ACTION_LIST);
  }

  static canReadVehicle(loggedUser: any, vehicle: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_READ);
  }

  static canCreateVehicle(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_CREATE);
  }

  static canUpdateVehicle(loggedUser: any, vehicle: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_UPDATE);
  }

  static canDeleteVehicle(loggedUser: any, vehicle: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE, Constants.ACTION_DELETE);
  }

  static canListVehicleManufacturers(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURERS, Constants.ACTION_LIST);
  }

  static canReadVehicleManufacturer(loggedUser: any, vehicleManufacturer: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_READ);
  }

  static canCreateVehicleManufacturer(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_CREATE);
  }

  static canUpdateVehicleManufacturer(loggedUser: any, vehicleManufacturer: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_UPDATE);
  }

  static canDeleteVehicleManufacturer(loggedUser: any, vehicleManufacturer: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER, Constants.ACTION_DELETE);
  }

  static canListSiteAreas(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREAS, Constants.ACTION_LIST);
  }

  static canReadSiteArea(loggedUser: any, siteArea: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_READ) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_READ,
        {"site": siteArea.siteID, "sites": loggedUser.sites});
  }

  static canCreateSiteArea(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_CREATE) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_CREATE);
  }

  static canUpdateSiteArea(loggedUser: any, siteArea: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_UPDATE) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_UPDATE);
  }

  static canDeleteSiteArea(loggedUser: any, siteArea: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA, Constants.ACTION_DELETE) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE, Constants.ACTION_DELETE);
  }

  static canListCompanies(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANIES, Constants.ACTION_LIST);
  }

  static canReadCompany(loggedUser: any, company: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_READ,
      {"company": company.id, "companies": loggedUser.companies});
  }

  static canCreateCompany(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_CREATE);
  }

  static canUpdateCompany(loggedUser: any, company: Company) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_UPDATE);
  }

  static canDeleteCompany(loggedUser: any, company: Company) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY, Constants.ACTION_DELETE);
  }

  static canListTenants(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANTS, Constants.ACTION_LIST);
  }

  static canReadTenant(loggedUser: any, tenant: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_READ);
  }

  static canCreateTenant(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_CREATE);
  }

  static canUpdateTenant(loggedUser: any, tenant: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_UPDATE);
  }

  static canDeleteTenant(loggedUser: any, tenant: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, Constants.ACTION_DELETE);
  }

  static canCreateConnection(loggedUser, connection) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_CREATE,
      {"user": connection.userId.toString(), "owner": loggedUser.id});
  }

  static canDeleteConnection(loggedUser, connection) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_DELETE,
      {"user": connection.userId.toString(), "owner": loggedUser.id});
  }

  static canReadConnection(loggedUser, connection) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, Constants.ACTION_READ,
      {"user": connection.userId.toString(), "owner": loggedUser.id});
  }

  static canListConnections(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTIONS, Constants.ACTION_LIST);
  }

  static canReadPricing(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING, Constants.ACTION_READ);
  }

  static canUpdatePricing(loggedUser: any) {
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING, Constants.ACTION_UPDATE);
  }

  static isSuperAdmin(loggedUser: any) {
    return loggedUser.role === Constants.ROLE_SUPER_ADMIN;
  }

  static isAdmin(loggedUser: any) {
    return loggedUser.role === Constants.ROLE_ADMIN;
  }

  static isBasic(loggedUser: any) {
    return loggedUser.role === Constants.ROLE_BASIC;
  }

  static isDemo(loggedUser: any) {
    return loggedUser.role === Constants.ROLE_DEMO;
  }

  static getConfiguration() {
    if (!this.configuration) {
      // Load it
      this.configuration = Configuration.getAuthorizationConfig();
    }
    return this.configuration;
  }

  static getUserScopes(role) {
    const scopes = [];
    this.accessControl.allowedResources({role: role}).forEach(
      resource => {
        this.accessControl.allowedActions({role: role, resource: resource}).forEach(
          action => {
            scopes.push(`${resource}:${action}`);
          }
        );
      }
    );
    return scopes;
  }

  static canPerformAction(loggedUser, resource, action, context?) {
    const permission = this.accessControl.can(loggedUser.role).execute(action).with(context).on(resource);
    if (!permission.granted && Authorizations.getConfiguration().debug) {
      Logging.logSecurityInfo({
        tenantID: loggedUser.tenantID, user: loggedUser,
        module: 'Authorizations', method: 'canPerformAction',
        message: `Role ${loggedUser.role} Cannot ${action} on ${resource} with context ${JSON.stringify(context)}`,
        action: 'Authorizations'
      });
    }
    return permission.granted;
  }
}
