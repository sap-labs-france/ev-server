import { Action, AuthorizationContext, AuthorizationResult, DynamicAuthorizationDataSourceName, Entity } from '../types/Authorization';
import ChargingStation, { Connector } from '../types/ChargingStation';
import Tenant, { TenantComponents } from '../types/Tenant';
import User, { UserRole } from '../types/User';

import AssignedSitesDynamicAuthorizationDataSource from './dynamic-data-source/AssignedSitesDynamicAuthorizationDataSource';
import AuthorizationConfiguration from '../types/configuration/AuthorizationConfiguration';
import AuthorizationsManager from './AuthorizationsManager';
import BackendError from '../exception/BackendError';
import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import CpoOCPIClient from '../client/ocpi/CpoOCPIClient';
import CpoOICPClient from '../client/oicp/CpoOICPClient';
import DynamicAuthorizationFactory from './DynamicAuthorizationFactory';
import Logging from '../utils/Logging';
import LoggingHelper from '../utils/LoggingHelper';
import NotificationHandler from '../notification/NotificationHandler';
import OCPIClientFactory from '../client/ocpi/OCPIClientFactory';
import { OCPIRole } from '../types/ocpi/OCPIRole';
import OCPIUtils from '../server/ocpi/OCPIUtils';
import OCPPStorage from '../storage/mongodb/OCPPStorage';
import { OICPAuthorizationStatus } from '../types/oicp/OICPAuthentication';
import OICPClientFactory from '../client/oicp/OICPClientFactory';
import { OICPDefaultTagId } from '../types/oicp/OICPIdentification';
import { OICPRole } from '../types/oicp/OICPRole';
import { PricingSettingsType } from '../types/Setting';
import { ServerAction } from '../types/Server';
import SessionHashService from '../server/rest/v1/service/SessionHashService';
import SettingStorage from '../storage/mongodb/SettingStorage';
import SitesAdminDynamicAuthorizationDataSource from './dynamic-data-source/SitesAdminDynamicAuthorizationDataSource';
import SitesOwnerDynamicAuthorizationDataSource from './dynamic-data-source/SitesOwnerDynamicAuthorizationDataSource';
import Tag from '../types/Tag';
import TagStorage from '../storage/mongodb/TagStorage';
import Transaction from '../types/Transaction';
import TransactionStorage from '../storage/mongodb/TransactionStorage';
import UserStorage from '../storage/mongodb/UserStorage';
import UserToken from '../types/UserToken';
import Utils from '../utils/Utils';
import _ from 'lodash';
import moment from 'moment';

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
      if (!chargingStation || !chargingStation.siteID || !chargingStation.siteAreaID) {
        return false;
      }
      context = {
        site: chargingStation.siteID,
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

  public static async getAuthorizedSiteIDs(tenant: Tenant, userToken: UserToken, requestedSites: string[]): Promise<string[]> {
    if (!Utils.isComponentActiveFromToken(userToken, TenantComponents.ORGANIZATION)) {
      return null;
    }
    if (this.isAdmin(userToken)) {
      return requestedSites;
    }
    const userAssignedSiteIDs = await Authorizations.getAssignedSiteIDs(tenant, userToken);
    if (Utils.isEmptyArray(requestedSites)) {
      return userAssignedSiteIDs.length > 0 ? userAssignedSiteIDs : null;
    }
    return requestedSites.filter((site) => userAssignedSiteIDs.includes(site));
  }

  public static async getAuthorizedSiteAdminIDs(tenant: Tenant, userToken: UserToken, requestedSites?: string[]): Promise<string[]> {
    if (!Utils.isComponentActiveFromToken(userToken, TenantComponents.ORGANIZATION)) {
      return null;
    }
    if (this.isDemo(userToken)) {
      return null;
    }
    if (this.isAdmin(userToken)) {
      return requestedSites;
    }
    const siteAdminSiteIDs = await Authorizations.getSiteAdminSiteIDs(tenant, userToken);
    const siteOwnerSiteIDs = await Authorizations.getSiteOwnerSiteIDs(tenant, userToken);
    const sites = _.uniq([...siteAdminSiteIDs, ...siteOwnerSiteIDs]);
    if (Utils.isEmptyArray(requestedSites)) {
      return sites;
    }
    return requestedSites.filter((site) => sites.includes(site));
  }

  public static async buildUserToken(tenant: Tenant, user: User, tags: Tag[]): Promise<UserToken> {
    const siteIDs = [];
    const siteAdminIDs = [];
    const siteOwnerIDs = [];
    // Get User's site
    const userSites = (await UserStorage.getUserSites(tenant, { userIDs: [user.id] },
      Constants.DB_PARAMS_MAX_LIMIT)).result;
    for (const userSite of userSites) {
      if (!Authorizations.isAdmin(user)) {
        siteIDs.push(userSite.site.id);
        if (userSite.siteAdmin) {
          siteAdminIDs.push(userSite.site.id);
        }
      }
      if (userSite.siteOwner) {
        siteOwnerIDs.push(userSite.site.id);
      }
    }
    let tenantHashID = Constants.DEFAULT_TENANT_ID;
    let activeComponents = [];
    let tenantName;
    let tenantSubdomain;
    if (tenant.id !== Constants.DEFAULT_TENANT_ID) {
      tenantName = tenant.name;
      tenantSubdomain = tenant.subdomain;
      tenantHashID = SessionHashService.buildTenantHashID(tenant);
      activeComponents = Utils.getTenantActiveComponents(tenant);
    }
    // Currency
    let currency = null;
    const pricing = await SettingStorage.getPricingSettings(tenant);
    if (pricing && pricing.type === PricingSettingsType.SIMPLE) {
      currency = pricing.simple.currency;
    }
    const authDefinition = AuthorizationsManager.getInstance();
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
      tenantID: tenant.id,
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

  public static async canListLoggings(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.LOGGING, Action.LIST);
  }

  public static async canReadLog(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.LOGGING, Action.READ);
  }

  public static async canListTransactions(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION, Action.LIST);
  }

  public static async canListTransactionsInError(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION, Action.IN_ERROR);
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

  public static async canUpdateTransaction(loggedUser: UserToken, transaction: Transaction): Promise<boolean> {
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
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION, Action.UPDATE, context);
  }

  public static async canDeleteTransaction(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TRANSACTION, Action.DELETE);
  }

  public static async canListChargingStations(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.LIST);
  }

  public static async canListChargingStationsInError(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_STATION, Action.IN_ERROR);
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

  public static async canListUsers(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.LIST, authContext);
  }

  public static async canListUsersInErrors(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.IN_ERROR, authContext);
  }

  public static async canListTags(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TAG, Action.LIST);
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
    return Authorizations.can(loggedUser, Entity.TAG, Action.IMPORT, authContext);
  }

  public static async canExportTags(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.TAG, Action.EXPORT, authContext);
  }

  public static async canReadUser(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.READ, authContext);
  }

  public static async canCreateUser(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.CREATE, authContext);
  }

  public static async canImportUsers(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.IMPORT, authContext);
  }

  public static async canExportUsers(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.EXPORT, authContext);
  }

  public static async canUpdateUser(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.UPDATE, authContext);
  }

  public static async canDeleteUser(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.DELETE, authContext);
  }

  public static async canListSites(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.SITE, Action.LIST, authContext);
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
    return Authorizations.canPerformAction(loggedUser, Entity.SETTING, Action.LIST);
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
    return Authorizations.canPerformAction(loggedUser, Entity.REGISTRATION_TOKEN, Action.CREATE, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static async canReadRegistrationToken(loggedUser: UserToken, siteID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.REGISTRATION_TOKEN, Action.READ, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static async canDeleteRegistrationToken(loggedUser: UserToken, siteID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.REGISTRATION_TOKEN, Action.DELETE, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static async canUpdateRegistrationToken(loggedUser: UserToken, siteID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.REGISTRATION_TOKEN, Action.UPDATE, {
      site: siteID,
      sites: loggedUser.sitesAdmin
    });
  }

  public static async canListRegistrationTokens(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.REGISTRATION_TOKEN, Action.LIST);
  }

  public static async canListOcpiEndpoints(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.OCPI_ENDPOINT, Action.LIST);
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
    return Authorizations.canPerformAction(loggedUser, Entity.OICP_ENDPOINT, Action.LIST);
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
    return Authorizations.canPerformAction(loggedUser, Entity.CHARGING_PROFILE, Action.LIST);
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
    return Authorizations.canPerformAction(loggedUser, Entity.CAR_CATALOG, Action.LIST);
  }

  public static async canListCars(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CAR, Action.LIST);
  }

  public static async canSynchronizeCarCatalogs(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.CAR_CATALOG, Action.SYNCHRONIZE, authContext);
  }

  public static async canUpdateCar(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.CAR, Action.UPDATE);
  }

  public static async canListAssets(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.LIST);
  }

  public static async canListAssetsInError(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.IN_ERROR);
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
    return Authorizations.canPerformAction(loggedUser, Entity.TENANT, Action.LIST);
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
    return Authorizations.canPerformAction(loggedUser, Entity.CONNECTION, Action.LIST);
  }

  public static async canReadPricingDefinition(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.PRICING_DEFINITION, Action.READ);
  }

  public static async canUpdatePricingModel(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.PRICING_DEFINITION, Action.UPDATE);
  }

  public static async canClearBillingTestData(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.BILLING, Action.CLEAR_BILLING_TEST_DATA);
  }

  public static async canCheckBillingConnection(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.BILLING, Action.CHECK_CONNECTION);
  }

  public static async canSynchronizeUserBilling(loggedUser: UserToken, authContext?: AuthorizationContext): Promise<AuthorizationResult> {
    return Authorizations.can(loggedUser, Entity.USER, Action.SYNCHRONIZE_BILLING_USER, authContext);
  }

  public static async canReadTaxesBilling(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.TAX, Action.LIST);
  }

  public static async canListInvoicesBilling(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICE, Action.LIST);
  }

  public static async canListTransfers(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.BILLING_TRANSFER, Action.LIST);
  }

  public static async canReadInvoiceBilling(loggedUser: UserToken, userID: string): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICE, Action.READ,
      { user: userID, owner: loggedUser.id });
  }

  public static async canSynchronizeInvoicesBilling(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.INVOICE, Action.SYNCHRONIZE);
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

  public static async canReadAssetConsumption(loggedUser: UserToken): Promise<boolean> {
    return Authorizations.canPerformAction(loggedUser, Entity.ASSET, Action.READ_CONSUMPTION);
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
    const authDefinition = AuthorizationsManager.getInstance();
    const result = await authDefinition.canPerformAction(loggedUser.rolesACL, entity, action, context);
    if (!result.authorized && Authorizations.getConfiguration().debug) {
      void Logging.logInfo({
        tenantID: loggedUser.tenantID, user: loggedUser,
        action: ServerAction.AUTHORIZATIONS,
        module: MODULE_NAME, method: 'canPerformAction',
        message: `Role ${loggedUser.role} Cannot ${action} on ${entity} with context ${JSON.stringify(context)}`,
      });
    }
    return result;
  }

  public static isChargingStationValidInOrganization(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation): boolean {
    // Org component enabled?
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
      // Check Site Area
      if (!chargingStation.siteAreaID || !chargingStation.siteArea) {
        throw new BackendError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action: action,
          module: MODULE_NAME, method: 'isTagIDAuthorizedOnChargingStation',
          message: `Charging Station '${chargingStation.id}' is not assigned to a Site Area!`,
          detailedMessages: { chargingStation }
        });
      }
      // Check Site
      if (!chargingStation.siteID) {
        throw new BackendError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action: action,
          module: MODULE_NAME, method: 'isTagIDAuthorizedOnChargingStation',
          message: `Site Area '${chargingStation.siteArea.name}' is not assigned to a Site!`,
          detailedMessages: { chargingStation }
        });
      }
      return true;
    }
  }

  public static async getSiteAdminSiteIDs(tenant: Tenant, userToken: UserToken): Promise<string[]> {
    const siteAdminDataSource = await DynamicAuthorizationFactory.getDynamicDataSource(
      tenant, userToken, DynamicAuthorizationDataSourceName.SITES_ADMIN) as SitesAdminDynamicAuthorizationDataSource;
    return siteAdminDataSource.getData().siteIDs;
  }

  public static async getSiteOwnerSiteIDs(tenant: Tenant, userToken: UserToken): Promise<string[]> {
    const siteOwnerDataSource = await DynamicAuthorizationFactory.getDynamicDataSource(
      tenant, userToken, DynamicAuthorizationDataSourceName.SITES_OWNER) as SitesOwnerDynamicAuthorizationDataSource;
    return siteOwnerDataSource.getData().siteIDs;
  }

  public static async getAssignedSiteIDs(tenant: Tenant, userToken: UserToken): Promise<string[]> {
    const userAssignedSiteDataSource = await DynamicAuthorizationFactory.getDynamicDataSource(
      tenant, userToken, DynamicAuthorizationDataSourceName.ASSIGNED_SITES) as AssignedSitesDynamicAuthorizationDataSource;
    return userAssignedSiteDataSource.getData().siteIDs;
  }

  public static async checkOCPIAuthorizedUser(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation,
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
    const ocpiClient = await OCPIClientFactory.getAvailableOcpiClient(tenant, OCPIRole.CPO) as CpoOCPIClient;
    if (!ocpiClient) {
      throw new BackendError({
        user: user, action,
        module: MODULE_NAME, method: 'checkOCPIAuthorizedUser',
        message: 'OCPI component requires at least one CPO endpoint to authorize users'
      });
    }
    // When no Transaction is provided, default connector is 1
    const connector = transaction?.connectorId ?
      Utils.getConnectorFromID(chargingStation, transaction.connectorId) : Utils.getConnectorFromID(chargingStation, 1);
    switch (authAction) {
      // OCPP Authorize
      case Action.AUTHORIZE:
        // Retrieve Authorization ID from Charging Station (Remote Start)
        user.authorizationID = await Authorizations.checkAndGetOCPIAuthorizationIDFromIOPRemoteStartTransaction(
          action, tenant, chargingStation, connector, tag, transaction);
        // Not found: Request one from OCPI IOP
        if (!user.authorizationID) {
          user.authorizationID = await ocpiClient.authorizeToken(
            tag.ocpiToken, chargingStation, connector);
        }
        break;
      // OCPP Start Transaction
      case Action.START_TRANSACTION:
        // Retrieve Authorization ID from OCPP Authorization with Roaming badge
        user.authorizationID = await Authorizations.checkAndGetOCPIAuthorizationIDFromOCPPAuthorize(
          tenant, transaction);
        if (!user.authorizationID) {
          // Retrieve Authorization ID from Charging Station (OCPI Remote Start)
          user.authorizationID = await Authorizations.checkAndGetOCPIAuthorizationIDFromIOPRemoteStartTransaction(
            action, tenant, chargingStation, connector, tag, transaction);
        }
        // Not found: Request one from OCPI IOP
        if (!user.authorizationID) {
          user.authorizationID = await ocpiClient.authorizeToken(
            tag.ocpiToken, chargingStation, connector);
        }
        break;
    }
  }

  public static notifyUnknownBadgeHasBeenUsed(
      action: ServerAction, tenant: Tenant, tagID: string, chargingStation: ChargingStation) {
    // Notify (Async)
    NotificationHandler.sendUnknownUserBadged(
      tenant,
      Utils.generateUUID(),
      chargingStation,
      {
        chargeBoxID: chargingStation.id,
        siteID: chargingStation.siteID,
        siteAreaID: chargingStation.siteAreaID,
        companyID: chargingStation.companyID,
        badgeID: tagID,
        evseDashboardURL: Utils.buildEvseURL(tenant.subdomain),
      }
    ).catch((error) => {
      Logging.logPromiseError(error, tenant?.id);
    });
  }

  public static async checkAndGetOICPAuthorizedUser(action: ServerAction, tenant: Tenant, transaction: Transaction, tagID: string) {
    if (Utils.isTenantComponentActive(tenant, TenantComponents.OICP)) {
    // Check if user has remote authorization or the session is already running
      if (tagID === OICPDefaultTagId.RemoteIdentification || transaction?.oicpData?.session?.id) {
        return UserStorage.getUserByEmail(tenant, Constants.OICP_VIRTUAL_USER_EMAIL);
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
        const virtualOICPUser = await UserStorage.getUserByEmail(tenant, Constants.OICP_VIRTUAL_USER_EMAIL);
        virtualOICPUser.authorizationID = response.SessionID;
        return virtualOICPUser;
      }
    }
  }

  public static async checkAndGetAuthorizedTag(action: ServerAction, tenant: Tenant, chargingStation: ChargingStation, tagID: string): Promise<Tag> {
  // Get Tag
    const tag = await TagStorage.getTag(tenant, tagID, { withUser: true });
    if (tag) {
      // Inactive Tag
      if (!tag.active) {
        throw new BackendError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
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
          ...LoggingHelper.getChargingStationProperties(chargingStation),
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

  private static async checkAndGetOCPIAuthorizationIDFromOCPPAuthorize(tenant: Tenant, transaction: Transaction) {
    let authorizationID: string;
    // Get the latest Authorization
    const authorizations = await OCPPStorage.getAuthorizes(tenant, {
      dateFrom: moment(transaction.timestamp).subtract(Constants.ROAMING_AUTHORIZATION_TIMEOUT_MINS, 'minutes').toDate(),
      chargeBoxID: transaction.chargeBoxID,
      tagID: transaction.tagID
    }, Constants.DB_PARAMS_MAX_LIMIT);
    // Found ID?
    if (!Utils.isEmptyArray(authorizations.result)) {
      // Get the first non used Authorization OCPI ID
      for (const authorization of authorizations.result) {
        if (authorization.authorizationId) {
          // Check Existing Transaction with the same Auth ID
          const ocpiTransaction = await TransactionStorage.getOCPITransactionByAuthorizationID(tenant, authorization.authorizationId);
          // OCPI Auth ID not used yet
          if (!ocpiTransaction) {
            authorizationID = authorization.authorizationId;
            break;
          }
        }
      }
    }
    return authorizationID;
  }

  private static async checkAndGetOCPIAuthorizationIDFromIOPRemoteStartTransaction(action: ServerAction, tenant: Tenant,
      chargingStation: ChargingStation, connector: Connector, tag: Tag, transaction: Transaction): Promise<string> {
    let authorizationID: string;
    if (!Utils.isEmptyArray(chargingStation.remoteAuthorizations)) {
      let remoteAuthorizationsUpdated = false;
      for (let i = chargingStation.remoteAuthorizations.length - 1; i >= 0; i--) {
        const remoteAuthorization = chargingStation.remoteAuthorizations[i];
        // Check validity
        if (remoteAuthorization && OCPIUtils.isAuthorizationValid(remoteAuthorization.timestamp)) {
          // Check Tag ID
          if (remoteAuthorization.tagId === tag.ocpiToken?.uid) {
            await Logging.logDebug({
              ...LoggingHelper.getChargingStationProperties(chargingStation),
              tenantID: tenant.id, action,
              message: `${Utils.buildConnectorInfo(connector.connectorId, transaction?.id)} Valid Remote Authorization found for Tag ID '${tag.ocpiToken.uid}'`,
              module: MODULE_NAME, method: 'checkOCPIAuthorizedUser',
              detailedMessages: { remoteAuthorization }
            });
            authorizationID = remoteAuthorization.id;
            break;
          }
        } else {
          // Expired: Remove it
          chargingStation.remoteAuthorizations.splice(i, 1);
          remoteAuthorizationsUpdated = true;
        }
      }
      // Update Remote Authorizations
      if (remoteAuthorizationsUpdated) {
        await ChargingStationStorage.saveChargingStationRemoteAuthorizations(
          tenant, chargingStation.id, chargingStation.remoteAuthorizations);
      }
    }
    return authorizationID;
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
    const authDefinition = AuthorizationsManager.getInstance();
    const authorized = await authDefinition.can(loggedUser.rolesACL, entity, action, context);
    if (!authorized && Authorizations.getConfiguration().debug) {
      void Logging.logInfo({
        tenantID: loggedUser.tenantID, user: loggedUser,
        action: ServerAction.AUTHORIZATIONS,
        module: MODULE_NAME, method: 'canPerformAction',
        message: `Role ${loggedUser.role} Cannot ${action} on ${entity} with context ${JSON.stringify(context)}`,
      });
    }
    return authorized;
  }
}
