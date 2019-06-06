import Logging from '../utils/Logging';
import Constants from '../utils/Constants';
import Configuration from '../utils/Configuration';
const Authorization = require('node-authorization').Authorization;
import NotificationHandler from '../notification/NotificationHandler';
import Mustache from 'mustache';
const compileProfile = require('node-authorization').profileCompiler;
import AppError from '../exception/AppError';
import AppAuthError from '../exception/AppAuthError';
import BackendError from '../exception/BackendError';
import Utils from '../utils/Utils';
import User from '../entity/User';
import Tenant from '../entity/Tenant';
import Transaction from '../entity/Transaction';
import Company from '../entity/Company';
import AuthorizationsDefinition from './AuthorizationsDefinition';
require('source-map-support').install();

export default class Authorizations {

  private static configuration: any;


  static canRefundTransaction(loggedUser: any, transaction: any) {
    // Check auth
    if (transaction.getUserJson()) {
      // Check
      return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
        { "Action": Constants.ACTION_REFUND_TRANSACTION, "UserID": transaction.getUserJson().id.toString() });
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
    // Find the corresponding auth
    const foundAuth = loggedUser.auths.find((auth: any) => auth.AuthObject === entityName);
    if (!foundAuth) {
      // Authorize all objects
      return null;
    }
    let fieldName;
    // Check Entity
    switch (entityName) {
      // Company
      case Constants.ENTITY_COMPANY:
        fieldName = 'CompanyID';
        break;
      // Site
      case Constants.ENTITY_SITE:
        fieldName = 'SiteID';
        break;
    }
    // Return the IDs
    if (fieldName) {
      // Not an array then authorize all objects
      if (foundAuth.AuthFieldValue[fieldName] &&
          Array.isArray(foundAuth.AuthFieldValue[fieldName])) {
        return foundAuth.AuthFieldValue[fieldName];
      }
    }
  }

  // Build Auth
  static async buildAuthorizations(user: any) {
    // Password OK
    const companies = [], users = [];
    let sites = [];

    // Check Admin
    if (!Authorizations.isAdmin(user.getModel())) {
      // Not Admin: Get Auth data
      // Get All Companies
      const allCompanies = await Company.getCompanies(user.getTenantID());
      // Get Sites
      sites = await user.getSites();
      // Get all the companies and site areas
      for (const site of sites) {
        // Get the company
        const company = allCompanies.result.find((company) => company.getID() === site.getCompanyID());
        // Found?
        if (company) {
          // Check
          const foundCompany = companies.find((existingCompany) => {
            return existingCompany.getID() === company.getID();
          });
          // Found?
          if (!foundCompany) {
            // No: Add it
            companies.push(company);
          }
        }
      }
    }
    // Convert to IDs
    const companyIDs = companies.map((company) => {
      return company.getID();
    });
    const siteIDs = sites.map((site: any) => {
      return site.getID();
    });
    // Get authorisation
    const authsDefinition = AuthorizationsDefinition.getAuthorizations(user.getRole());
    // Add user
    users.push(user.getID());
    // Parse the auth and replace values
    const authsDefinitionParsed = Mustache.render(
      authsDefinition,
      {
        "userID": users,
        "companyID": companyIDs,
        "siteID": siteIDs,
        "trim": () => {
          return (text: any, render: any) => {
            // trim trailing comma and whitespace
            return render(text).replace(/(,\s*$)/g, '');
          };
        }
      }
    );
    // Make it Json
    const userAuthDefinition = JSON.parse(authsDefinitionParsed);
    // Compile auths of the role
    const compiledAuths = compileProfile(userAuthDefinition.auths);
    // Return
    return compiledAuths;
  }

  static async _checkAndGetUserTagIDOnChargingStation(chargingStation: any, tagID: any, isOrgCompActive: any, site: any, action: any) {
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
    // Add user authorizations
    user.setAuthorizations(await Authorizations.buildAuthorizations(user));
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

  static async isTagIDAuthorizedOnChargingStation(chargingStation: any, tagID: any, action: any) {
    let site, siteArea;
    // Get the Organization component
    const isOrgCompActive = await chargingStation.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
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
      site = await siteArea.getSite(null, true);
      if (!site) {
        // Reject Site Not Found
        throw new AppError(
          chargingStation.getID(),
          `Site Area '${siteArea.getName()}' is not assigned to a Site!`, 525,
          "Authorizations", "_checkAndGetUserOnChargingStation");
      }
    }
    // Get user
    let user = null;
    // Get the user
    if (tagID) {
      user = await Authorizations._checkAndGetUserTagIDOnChargingStation(
        chargingStation, tagID, isOrgCompActive, site, action);
    }
    // Found?
    if (user) {
      // Check Authorization
      await Authorizations._checkAndGetUserOnChargingStation(
        chargingStation, user, isOrgCompActive, site, action);
    }
    return user;
  }

  static async isTagIDsAuthorizedOnChargingStation(chargingStation: any, tagId: any, transactionTagId: any, action: any) {
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
        const isOrgCompActive = await chargingStation.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
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
    // Build Authorizations -----------------------------------------------------
    const auths = await Authorizations.buildAuthorizations(user);
    // Set
    user.setAuthorizations(auths);
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
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGINGS,
      { "Action": Constants.ACTION_LIST });
  }

  static canReadLogging(loggedUser: any, logging: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_LOGGING,
      { "Action": Constants.ACTION_READ, "LogID": logging.id.toString() });
  }

  static canListTransactions(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS,
      { "Action": Constants.ACTION_LIST });
  }

  static canListTransactionsInError(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTIONS,
      { "Action": Constants.ACTION_LIST });
  }

  static canReadTransaction(loggedUser: any, transaction: any) {
    // Check auth
    if (transaction.getUserJson() && transaction.getUserJson().id) {
      // Check
      return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
        { "Action": Constants.ACTION_READ, "UserID": transaction.getUserJson().id.toString() });
      // Admin?
    } else if (!Authorizations.isAdmin(loggedUser)) {
      return false;
    }
    return true;
  }

  static canUpdateTransaction(loggedUser: any, transaction: any) {
    // Check auth
    if (transaction.getUserJson()) {
      // Check
      return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
        { "Action": Constants.ACTION_UPDATE, "UserID": transaction.getUserJson().id.toString() });
      // Admin?
    } else if (!Authorizations.isAdmin(loggedUser)) {
      return false;
    }
    return true;
  }

  static canDeleteTransaction(loggedUser: any, transaction: any) {
    // Check auth
    if (transaction.getUserJson()) {
      // Check
      return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TRANSACTION,
        { "Action": Constants.ACTION_DELETE, "UserID": transaction.getUserJson().id.toString() });
      // Admin?
    } else if (!Authorizations.isAdmin(loggedUser)) {
      return false;
    }
    return true;
  }

  static canListChargingStations(loggedUser: any) {
    // Check Charging Station
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATIONS,
      { "Action": Constants.ACTION_LIST });
  }

  static canPerformActionOnChargingStation(loggedUser: any, chargingStation: any, action: any) {
    // Check Charging Station
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
      { "Action": action, "ChargingStationID": chargingStation.id });
  }

  static canReadChargingStation(loggedUser: any, chargingStation: any) {
    // Check Charging Station
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
      { "Action": Constants.ACTION_READ, "ChargingStationID": chargingStation.id });
  }

  static canUpdateChargingStation(loggedUser: any, chargingStation: any) {
    // Check Charging Station
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
      { "Action": Constants.ACTION_UPDATE, "ChargingStationID": chargingStation.id });
  }

  static canDeleteChargingStation(loggedUser: any, chargingStation: any) {
    // Check Charging Station
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CHARGING_STATION,
      { "Action": Constants.ACTION_DELETE, "ChargingStationID": chargingStation.id });
  }

  static canListUsers(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USERS,
      { "Action": Constants.ACTION_LIST });
  }

  static canReadUser(loggedUser: any, user: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER,
      { "Action": Constants.ACTION_READ, "UserID": user.id.toString() });
  }

  static canLogoutUser(loggedUser: any, user: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER,
      { "Action": Constants.ACTION_LOGOUT, "UserID": user.id.toString() });
  }

  static canCreateUser(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER,
      { "Action": Constants.ACTION_CREATE });
  }

  static canUpdateUser(loggedUser: any, user: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER,
      { "Action": Constants.ACTION_UPDATE, "UserID": user.id.toString() });
  }

  static canDeleteUser(loggedUser: any, user: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_USER,
      { "Action": Constants.ACTION_DELETE, "UserID": user.id.toString() });
  }

  static canListSites(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITES,
      { "Action": Constants.ACTION_LIST });
  }

  static canReadSite(loggedUser: any, site: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
      { "Action": Constants.ACTION_READ, "SiteID": site.id.toString() });
  }

  static canCreateSite(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
      { "Action": Constants.ACTION_CREATE });
  }

  static canUpdateSite(loggedUser: any, site: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
      { "Action": Constants.ACTION_UPDATE, "SiteID": site.id.toString() });
  }

  static canDeleteSite(loggedUser: any, site: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
      { "Action": Constants.ACTION_DELETE, "SiteID": site.id.toString() });
  }

  static canListSettings(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTINGS,
      { "Action": Constants.ACTION_LIST });
  }

  static canReadSetting(loggedUser: any, setting: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING,
      { "Action": Constants.ACTION_READ, "SettingID": setting.id.toString() });
  }

  static canDeleteSetting(loggedUser: any, setting: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING,
      { "Action": Constants.ACTION_DELETE, "SettingID": setting.id.toString() });
  }

  static canCreateSetting(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING,
      { "Action": Constants.ACTION_CREATE });
  }

  static canUpdateSetting(loggedUser: any, setting: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SETTING,
      { "Action": Constants.ACTION_UPDATE, "SettingID": setting.id.toString() });
  }

  static canListOcpiEndpoints(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINTS,
      { "Action": Constants.ACTION_LIST });
  }

  static canReadOcpiEndpoint(loggedUser: any, ocpiendpoint: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT,
      { "Action": Constants.ACTION_READ, "OcpiEndpointID": ocpiendpoint.id.toString() });
  }

  static canDeleteOcpiEndpoint(loggedUser: any, ocpiendpoint: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT,
      { "Action": Constants.ACTION_DELETE, "OcpiEndpointID": ocpiendpoint.id.toString() });
  }

  static canCreateOcpiEndpoint(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT,
      { "Action": Constants.ACTION_CREATE });
  }

  static canUpdateOcpiEndpoint(loggedUser: any, ocpiendpoint: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT,
      { "Action": Constants.ACTION_UPDATE, "OcpiEndpointID": ocpiendpoint.id.toString() });
  }

  static canPingOcpiEndpoint(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT,
      { "Action": Constants.ACTION_PING });
  }

  static canSendEVSEStatusesOcpiEndpoint(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT,
      { "Action": Constants.ACTION_SEND_EVSE_STATUSES });
  }

  static canRegisterOcpiEndpoint(loggedUser: any, ocpiendpoint: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT,
      { "Action": Constants.ACTION_REGISTER, "OcpiEndpointID": ocpiendpoint.id.toString() });
  }

  static canGenerateLocalTokenOcpiEndpoint(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_OCPI_ENDPOINT,
      { "Action": Constants.ACTION_GENERATE_LOCAL_TOKEN });
  }

  static canListVehicles(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLES,
      { "Action": Constants.ACTION_LIST });
  }

  static canReadVehicle(loggedUser: any, vehicle: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
      { "Action": Constants.ACTION_READ, "VehicleID": vehicle.id.toString() });
  }

  static canCreateVehicle(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
      { "Action": Constants.ACTION_CREATE });
  }

  static canUpdateVehicle(loggedUser: any, vehicle: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
      { "Action": Constants.ACTION_UPDATE, "VehicleID": vehicle.id.toString() });
  }

  static canDeleteVehicle(loggedUser: any, vehicle: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE,
      { "Action": Constants.ACTION_DELETE, "VehicleID": vehicle.id.toString() });
  }

  static canListVehicleManufacturers(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURERS,
      { "Action": Constants.ACTION_LIST });
  }

  static canReadVehicleManufacturer(loggedUser: any, vehicleManufacturer: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
      { "Action": Constants.ACTION_READ, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
  }

  static canCreateVehicleManufacturer(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
      { "Action": Constants.ACTION_CREATE });
  }

  static canUpdateVehicleManufacturer(loggedUser: any, vehicleManufacturer: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
      { "Action": Constants.ACTION_UPDATE, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
  }

  static canDeleteVehicleManufacturer(loggedUser: any, vehicleManufacturer: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_VEHICLE_MANUFACTURER,
      { "Action": Constants.ACTION_DELETE, "VehicleManufacturerID": vehicleManufacturer.id.toString() });
  }

  static canListSiteAreas(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREAS,
      { "Action": Constants.ACTION_LIST });
  }

  static canReadSiteArea(loggedUser: any, siteArea: any) {
    // Check Site Area && Site
    return (
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
        { "Action": Constants.ACTION_READ, "SiteAreaID": siteArea.id.toString() }) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
        { "Action": Constants.ACTION_READ, "SiteID": siteArea.siteID }));
  }

  static canCreateSiteArea(loggedUser: any) {
    // Check Site Area && Site
    return (
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
        { "Action": Constants.ACTION_CREATE }) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
        { "Action": Constants.ACTION_CREATE }));
  }

  static canUpdateSiteArea(loggedUser: any, siteArea: any) {
    // Check Site Area && Site
    return (
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
        { "Action": Constants.ACTION_UPDATE, "SiteAreaID": siteArea.id.toString() }) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
        { "Action": Constants.ACTION_UPDATE, "SiteID": siteArea.siteID }));
  }

  static canDeleteSiteArea(loggedUser: any, siteArea: any) {
    // Check Site Area && Site
    return (
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE_AREA,
        { "Action": Constants.ACTION_DELETE, "SiteAreaID": siteArea.id.toString() }) &&
      Authorizations.canPerformAction(loggedUser, Constants.ENTITY_SITE,
        { "Action": Constants.ACTION_DELETE, "SiteID": siteArea.siteID }));
  }

  static canListCompanies(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANIES,
      { "Action": Constants.ACTION_LIST });
  }

  static canReadCompany(loggedUser: any, company: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
      { "Action": Constants.ACTION_READ, "CompanyID": company.id.toString() });
  }

  static canCreateCompany(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
      { "Action": Constants.ACTION_CREATE });
  }

  static canUpdateCompany(loggedUser: any, company: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
      { "Action": Constants.ACTION_UPDATE, "CompanyID": company.id.toString() });
  }

  static canDeleteCompany(loggedUser: any, company: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_COMPANY,
      { "Action": Constants.ACTION_DELETE, "CompanyID": company.id.toString() });
  }

  static canListTenants(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANTS, {
      "Action": Constants.ACTION_LIST
    });
  }

  static canReadTenant(loggedUser: any, tenant: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, {
      "Action": Constants.ACTION_READ,
      "TenantID": tenant.id.toString()
    });
  }

  static canCreateTenant(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, {
      "Action": Constants.ACTION_CREATE
    });
  }

  static canUpdateTenant(loggedUser: any, tenant: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, {
      "Action": Constants.ACTION_UPDATE,
      "TenantID": tenant.id.toString()
    });
  }

  static canDeleteTenant(loggedUser: any, tenant: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_TENANT, {
      "Action": Constants.ACTION_DELETE,
      "TenantID": tenant.id.toString()
    });
  }

  static canCreateConnection(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, {
      "Action": Constants.ACTION_CREATE
    });
  }

  static canDeleteConnection(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION, {
      "Action": Constants.ACTION_DELETE
    });
  }

  static canReadConnection(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTION,
      { "Action": Constants.ACTION_READ });
  }

  static canListConnections(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_CONNECTIONS,
      { "Action": Constants.ACTION_LIST });
  }

  static canReadPricing(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING,
      { "Action": Constants.ACTION_READ });
  }

  static canUpdatePricing(loggedUser: any) {
    // Check
    return Authorizations.canPerformAction(loggedUser, Constants.ENTITY_PRICING,
      { "Action": Constants.ACTION_UPDATE });
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

  static canPerformAction(loggedUser: any, entity: any, fieldNamesValues: any) {
    // Set debug mode?
    if (Authorizations.getConfiguration().debug) {
      // Switch on traces
      Authorization.switchTraceOn();
    }
    // Create Auth
    const auth = new Authorization(loggedUser.role, loggedUser.auths);
    // Check
    if (auth.check(entity, fieldNamesValues)) {
      // Authorized!
      return true;
    } else {
      return false;
    }
  }
}
