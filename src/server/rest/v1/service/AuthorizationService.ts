import { Action, AuthorizationActions, AuthorizationContext, AuthorizationFilter, DynamicAuthorizationsFilter, Entity } from '../../../../types/Authorization';
import { AssetDataResult, BillingAccountsDataResult, BillingInvoiceDataResult, BillingPaymentMethodDataResult, BillingTaxDataResult, BillingTransfersDataResult, CarCatalogDataResult, CarDataResult, ChargingProfileDataResult, ChargingStationDataResult, ChargingStationTemplateDataResult, CompanyDataResult, LogDataResult, OcpiEndpointDataResult, PricingDefinitionDataResult, RegistrationTokenDataResult, SettingDBDataResult, SiteAreaDataResult, SiteDataResult, SiteUserDataResult, TagDataResult, TransactionDataResult, TransactionInErrorDataResult, UserDataResult, UserSiteDataResult } from '../../../../types/DataResult';
import { BillingAccount, BillingInvoice, BillingPaymentMethod, BillingTax, BillingTransfer } from '../../../../types/Billing';
import { Car, CarCatalog } from '../../../../types/Car';
import { ChargePointStatus, OCPPProtocol, OCPPVersion } from '../../../../types/ocpp/OCPPServer';
import ChargingStation, { ChargingStationTemplate } from '../../../../types/ChargingStation';
import { HttpAssetGetRequest, HttpAssetsGetRequest } from '../../../../types/requests/HttpAssetRequest';
import { HttpBillingAccountGetRequest, HttpBillingAccountsGetRequest, HttpBillingInvoiceRequest, HttpBillingInvoicesRequest, HttpBillingTransferGetRequest, HttpBillingTransfersGetRequest, HttpDeletePaymentMethod, HttpPaymentMethods, HttpSetupPaymentMethod } from '../../../../types/requests/HttpBillingRequest';
import { HttpCarCatalogGetRequest, HttpCarCatalogsGetRequest, HttpCarGetRequest, HttpCarsGetRequest } from '../../../../types/requests/HttpCarRequest';
import { HttpChargingProfileRequest, HttpChargingProfilesGetRequest, HttpChargingStationGetRequest, HttpChargingStationsGetRequest } from '../../../../types/requests/HttpChargingStationRequest';
import { HttpChargingStationTemplateGetRequest, HttpChargingStationTemplatesGetRequest } from '../../../../types/requests/HttpChargingStationTemplateRequest';
import { HttpCompaniesGetRequest, HttpCompanyGetRequest } from '../../../../types/requests/HttpCompanyRequest';
import { HttpPricingDefinitionGetRequest, HttpPricingDefinitionsGetRequest } from '../../../../types/requests/HttpPricingRequest';
import { HttpSettingGetRequest, HttpSettingsGetRequest } from '../../../../types/requests/HttpSettingRequest';
import { HttpSiteAreaGetRequest, HttpSiteAreasGetRequest } from '../../../../types/requests/HttpSiteAreaRequest';
import { HttpSiteAssignUsersRequest, HttpSiteGetRequest, HttpSiteUsersRequest } from '../../../../types/requests/HttpSiteRequest';
import { HttpTagGetRequest, HttpTagsGetRequest } from '../../../../types/requests/HttpTagRequest';
import { HttpTransactionConsumptionsGetRequest, HttpTransactionGetRequest } from '../../../../types/requests/HttpTransactionRequest';
import { HttpUserGetRequest, HttpUserSitesAssignRequest, HttpUserSitesGetRequest, HttpUsersGetRequest } from '../../../../types/requests/HttpUserRequest';
import RefundReport, { RefundStatus } from '../../../../types/Refund';

import AppAuthError from '../../../../exception/AppAuthError';
import Asset from '../../../../types/Asset';
import Authorizations from '../../../../authorization/Authorizations';
import { ChargingProfile } from '../../../../types/ChargingProfile';
import Company from '../../../../types/Company';
import DynamicAuthorizationFactory from '../../../../authorization/DynamicAuthorizationFactory';
import { EntityData } from '../../../../types/GlobalType';
import { HTTPAuthError } from '../../../../types/HTTPError';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpLogGetRequest } from '../../../../types/requests/HttpLogRequest';
import { HttpOCPIEndpointGetRequest } from '../../../../types/requests/HttpOCPIEndpointRequest';
import { HttpRegistrationTokenGetRequest } from '../../../../types/requests/HttpRegistrationToken';
import { Log } from '../../../../types/Log';
import { OCPICapability } from '../../../../types/ocpi/OCPIEvse';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import PricingDefinition from '../../../../types/Pricing';
import RegistrationToken from '../../../../types/RegistrationToken';
import { ServerAction } from '../../../../types/Server';
import { Setting } from '../../../../types/Setting';
import Site from '../../../../types/Site';
import SiteArea from '../../../../types/SiteArea';
import Tag from '../../../../types/Tag';
import Tenant from '../../../../types/Tenant';
import Transaction from '../../../../types/Transaction';
import { TransactionInError } from '../../../../types/InError';
import User from '../../../../types/User';
import UserToken from '../../../../types/UserToken';
import Utils from '../../../../utils/Utils';
import _ from 'lodash';

const MODULE_NAME = 'AuthorizationService';

export default class AuthorizationService {
  public static canPerformAction(authActions: AuthorizationActions, action: Action): boolean {
    return authActions[`can${action}`];
  }

  public static async checkAndGetSiteAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSiteGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.SITE, userToken, filteredRequest, filteredRequest.ID ? { SiteID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetLoggingAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpLogGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.LOGGING, userToken, filteredRequest, filteredRequest.ID ? { LogID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addSitesAuthorizations(tenant: Tenant, userToken: UserToken, sites: SiteDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    sites.metadata = authorizationFilter.metadata;
    // Add Authorizations
    sites.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE, Action.CREATE, authorizationFilter);
    sites.canListCompanies = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.COMPANY, Action.LIST, authorizationFilter);
    for (const site of sites.result) {
      await AuthorizationService.addSiteAuthorizations(tenant, userToken, site, authorizationFilter);
    }
  }

  public static async addSiteAuthorizations(tenant: Tenant, userToken: UserToken, site: Site, authorizationFilter: AuthorizationFilter): Promise<void> {
    site.canRead = true; // Always true as it should be filtered upfront
    site.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE, Action.DELETE, authorizationFilter, { SiteID: site.id }, site);
    site.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE, Action.UPDATE, authorizationFilter, { SiteID: site.id }, site);
    site.canMaintainPricingDefinitions = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE, Action.MAINTAIN_PRICING_DEFINITIONS, authorizationFilter, { SiteID: site.id }, site);
    site.canExportOCPPParams = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.EXPORT_OCPP_PARAMS, authorizationFilter, { SiteID: site.id }, site);
    site.canGenerateQrCode = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.GENERATE_QR, authorizationFilter, { SiteID: site.id }, site);
    site.canAssignUnassignUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE, Action.ASSIGN_UNASSIGN_USERS, authorizationFilter, { SiteID: site.id }, site);
    site.canListSiteUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_USER, Action.LIST, authorizationFilter, { SiteID: site.id }, site);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(site);
  }

  public static async addLogsAuthorizations(tenant: Tenant, userToken: UserToken, logs: LogDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    logs.metadata = authorizationFilter.metadata;
    // Add Authorizations
    logs.canExport = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.LOGGING, Action.EXPORT, authorizationFilter);
    for (const log of logs.result) {
      AuthorizationService.addLogAuthorizations(tenant, userToken, log, authorizationFilter);
    }
  }

  public static addLogAuthorizations(tenant: Tenant, userToken: UserToken, log: Log, authorizationFilter: AuthorizationFilter): void {
    log.canRead = true; // Always true as it should be filtered upfront
  }

  public static async checkAndGetSitesAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSiteUsersRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.SITE, Action.LIST,
      authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetLoggingsAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSiteUsersRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.LOGGING, Action.LIST,
      authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetSiteUsersAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSiteUsersRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Filter projected fields
    authorizations.projectFields = AuthorizationService.filterProjectFields(authorizations.projectFields, filteredRequest.ProjectFields);
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.SITE_USER, Action.LIST,
      authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetUserSitesAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpUserSitesGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Filter projected fields
    authorizations.projectFields = AuthorizationService.filterProjectFields(authorizations.projectFields, filteredRequest.ProjectFields);
    // Handle Sites
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.USER_SITE, Action.LIST,
      authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  // Assign/unassign users to/from site
  public static async checkAssignSiteUsersAuthorizations(tenant: Tenant, action: ServerAction, userToken: UserToken,
      filteredRequest: Partial<HttpSiteAssignUsersRequest>): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    const authAction = action === ServerAction.ADD_USERS_TO_SITE ? Action.ASSIGN_USERS_TO_SITE : Action.UNASSIGN_USERS_FROM_SITE;
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.SITE_USER, authAction,
      authorizations, filteredRequest, null, true);
    return authorizations;
  }

  // Assign/unassign sites to/from user
  public static async checkAssignUserSitesAuthorizations(tenant: Tenant, action: ServerAction, userToken: UserToken,
      filteredRequest: Partial<HttpUserSitesAssignRequest>): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    const authAction = action === ServerAction.ADD_SITES_TO_USER ? Action.ASSIGN_SITES_TO_USER : Action.UNASSIGN_SITES_FROM_USER;
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.USER_SITE, authAction,
      authorizations, filteredRequest, null, true);
    return authorizations;
  }

  public static async addUserSitesAuthorizations(tenant: Tenant, userToken: UserToken, userSites: UserSiteDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    userSites.metadata = authorizationFilter.metadata;
    // Add Authorizations
    userSites.canUpdateUserSites = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.USER_SITE, Action.UPDATE, authorizationFilter);
  }

  public static async addUserSiteAuthToSitesAuthorizations(tenant: Tenant, userToken: UserToken, user: User, sites: Site[], authorizationFilter: AuthorizationFilter): Promise<void> {
    for (const site of sites) {
      site.canAssignSitesToUser = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.USER_SITE, Action.ASSIGN_SITES_TO_USER, authorizationFilter, { UserID: user.id }, site);
      site.canUnassignSitesFromUser = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.USER_SITE, Action.UNASSIGN_SITES_FROM_USER, authorizationFilter, { UserID: user.id }, site);
      // Optimize data over the net
      Utils.removeCanPropertiesWithFalseValue(site);
    }
  }

  public static async addSiteUsersAuthorizations(tenant: Tenant, userToken: UserToken, siteUsers: SiteUserDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    siteUsers.metadata = authorizationFilter.metadata;
    // Add Authorizations
    siteUsers.canUpdateSiteUsers = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE_USER, Action.UPDATE, authorizationFilter);
  }

  // eslint-disable-next-line max-len
  public static async addSiteUserAuthToUsersAuthorizations(tenant: Tenant, userToken: UserToken, site: Site, users: User[], authorizationFilter: AuthorizationFilter): Promise<void> {
    for (const user of users) {
      user.canAssignUsersToSite = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_USER, Action.ASSIGN_USERS_TO_SITE, authorizationFilter, { UserID: user.id }, site);
      user.canUnassignUsersFromSite = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.SITE_USER, Action.UNASSIGN_USERS_FROM_SITE, authorizationFilter, { UserID: user.id }, site);
      // Optimize data over the net
      Utils.removeCanPropertiesWithFalseValue(user);
    }
  }


  public static async checkAndGetUsersInErrorAuthorizations(tenant: Tenant, userToken: UserToken, filteredRequest: Partial<HttpUsersGetRequest>): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.USER, Action.IN_ERROR,
      authorizations, filteredRequest, null, true);
    return authorizations;
  }

  public static async addUsersAuthorizations(tenant: Tenant, userToken: UserToken, users: UserDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    users.metadata = authorizationFilter.metadata;
    // Add Authorizations
    users.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.CREATE, authorizationFilter);
    users.canExport = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.EXPORT, authorizationFilter);
    users.canImport = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.IMPORT, authorizationFilter);
    users.canListTags = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.LIST, authorizationFilter);
    users.canListSites = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE, Action.LIST, authorizationFilter);
    for (const user of users.result) {
      await AuthorizationService.addUserAuthorizations(tenant, userToken, user, authorizationFilter);
    }
  }

  public static async addUserAuthorizations(tenant: Tenant, userToken: UserToken, user: User, authorizationFilter: AuthorizationFilter): Promise<void> {
    user.canRead = true; // Always true as it should be filtered upfront
    user.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.UPDATE, authorizationFilter, { UserID: user.id }, user);
    user.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.DELETE, authorizationFilter, { UserID: user.id }, user);
    user.canAssignUnassignSites = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.ASSIGN_UNASSIGN_SITES, authorizationFilter, { UserID: user.id }, user);
    user.canListUserSites = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER_SITE, Action.LIST, authorizationFilter, { UserID: user.id }, user);
    user.canListTags = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.LIST, authorizationFilter, { UserID: user.id }, user);
    user.canListCompletedTransactions = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.GET_COMPLETED_TRANSACTION, authorizationFilter, { UserID: user.id }, user);
    user.canSynchronizeBillingUser = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.SYNCHRONIZE_BILLING_USER, authorizationFilter, { UserID: user.id }, user);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(user);
  }

  public static async checkAndGetUsersAuthorizations(tenant: Tenant, userToken: UserToken,
      authAction: Action, filteredRequest?: Partial<HttpUsersGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.USER, authAction, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetAssetsAuthorizations(tenant: Tenant, userToken: UserToken,
      authAction: Action, filteredRequest?: HttpAssetsGetRequest, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.ASSET, authAction, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetAssetAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action,
      filteredRequest: Partial<HttpAssetGetRequest>, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.ASSET, userToken, filteredRequest, filteredRequest.ID ? { AssetID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addAssetsAuthorizations(tenant: Tenant, userToken: UserToken, assets: AssetDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    assets.metadata = authorizationFilter.metadata;
    // Add Authorizations
    assets.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.ASSET, Action.CREATE, authorizationFilter);
    assets.canListSites = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE, Action.LIST, authorizationFilter);
    assets.canListSiteAreas = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.LIST, authorizationFilter);
    for (const asset of assets.result) {
      await AuthorizationService.addAssetAuthorizations(tenant, userToken, asset, authorizationFilter);
    }
  }

  public static async addAssetAuthorizations(tenant: Tenant, userToken: UserToken, asset: Asset, authorizationFilter: AuthorizationFilter): Promise<void> {
    asset.canRead = true; // Always true as it should be filtered upfront
    asset.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.ASSET, Action.DELETE, authorizationFilter, {}, asset);
    asset.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.ASSET, Action.UPDATE, authorizationFilter, {}, asset);
    asset.canCheckConnection = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.ASSET, Action.CHECK_CONNECTION, authorizationFilter, {}, asset);
    // Additional auth rules based on asset attributes
    asset.canRetrieveConsumption = asset.dynamicAsset && !asset.usesPushAPI &&
      await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.ASSET, Action.RETRIEVE_CONSUMPTION, authorizationFilter, {}, asset);
    asset.canReadConsumption = asset.dynamicAsset &&
      await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.ASSET, Action.READ_CONSUMPTION, authorizationFilter, {}, asset);
    asset.canCreateConsumption = asset.dynamicAsset && asset.usesPushAPI &&
      await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.ASSET, Action.CREATE_CONSUMPTION, authorizationFilter, {}, asset);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(asset);
  }

  public static async checkAndGetUserAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpUserGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.USER, userToken, filteredRequest, filteredRequest.ID ? { UserID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetTagsAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpTagsGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.LIST, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetTagAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpTagGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.TAG, userToken, filteredRequest, filteredRequest.ID ? { TagID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addTagsAuthorizations(tenant: Tenant, userToken: UserToken, tags: TagDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    tags.metadata = authorizationFilter.metadata;
    // Add Authorizations
    tags.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.CREATE, authorizationFilter);
    tags.canAssign = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.ASSIGN, authorizationFilter);
    tags.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.DELETE, authorizationFilter);
    tags.canImport = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.IMPORT, authorizationFilter);
    tags.canExport = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.EXPORT, authorizationFilter);
    tags.canUnassign = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.UNASSIGN, authorizationFilter);
    tags.canListUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.LIST, authorizationFilter);
    tags.canListSources = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SOURCE, Action.LIST, authorizationFilter);
    for (const tag of tags.result) {
      await AuthorizationService.addTagAuthorizations(tenant, userToken, tag, authorizationFilter);
    }
  }

  public static async addTagAuthorizations(tenant: Tenant, userToken: UserToken, tag: Tag, authorizationFilter: AuthorizationFilter): Promise<void> {
    tag.canRead = true; // Always true as it should be filtered upfront
    tag.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.DELETE, authorizationFilter, { TagID: tag.id }, tag);
    tag.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.UPDATE, authorizationFilter, { TagID: tag.id }, tag);
    tag.canUpdateByVisualID = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.UPDATE_BY_VISUAL_ID, authorizationFilter, { TagID: tag.id }, tag);
    tag.canUnassign = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.UNASSIGN, authorizationFilter, { TagID: tag.id }, tag);
    tag.canAssign = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAG, Action.ASSIGN, authorizationFilter, { TagID: tag.id }, tag);
    tag.canListUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.LIST, authorizationFilter);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(tag);
  }

  public static async checkAndGetRegistrationTokenAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpRegistrationTokenGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.REGISTRATION_TOKEN, userToken, filteredRequest, filteredRequest.ID ? { registrationTokenID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetRegistrationTokensAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpCompaniesGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.REGISTRATION_TOKEN, Action.LIST, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async addRegistrationTokensAuthorizations(tenant: Tenant, userToken: UserToken, registrationTokens: RegistrationTokenDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    registrationTokens.metadata = authorizationFilter.metadata;
    // Add Authorizations
    registrationTokens.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.REGISTRATION_TOKEN, Action.CREATE, authorizationFilter);
    for (const registrationToken of registrationTokens.result) {
      await AuthorizationService.addRegistrationTokenAuthorizations(tenant, userToken, registrationToken, authorizationFilter);
    }
  }

  public static async addRegistrationTokenAuthorizations(tenant: Tenant, userToken: UserToken, registrationToken: RegistrationToken,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    registrationToken.canRead = true; // Always true as it should be filtered upfront
    registrationToken.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.REGISTRATION_TOKEN, Action.DELETE, authorizationFilter, { RegistrationTokenID: registrationToken.id }, registrationToken);
    registrationToken.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.REGISTRATION_TOKEN, Action.UPDATE, authorizationFilter, { RegistrationTokenID: registrationToken.id }, registrationToken);
    registrationToken.canRevoke = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.REGISTRATION_TOKEN, Action.REVOKE, authorizationFilter, { RegistrationTokenID: registrationToken.id }, registrationToken);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(registrationToken);
    // Build OCPP URLs
    registrationToken.ocpp15SOAPSecureUrl = Utils.buildOCPPServerSecureURL(tenant.id, OCPPVersion.VERSION_15, OCPPProtocol.SOAP, registrationToken.id);
    registrationToken.ocpp16SOAPSecureUrl = Utils.buildOCPPServerSecureURL(tenant.id, OCPPVersion.VERSION_16, OCPPProtocol.SOAP, registrationToken.id);
    registrationToken.ocpp16JSONSecureUrl = Utils.buildOCPPServerSecureURL(tenant.id, OCPPVersion.VERSION_16, OCPPProtocol.JSON, registrationToken.id);
  }

  public static async checkAndGetChargingStationTemplateAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpChargingStationTemplateGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.CHARGING_STATION_TEMPLATE, userToken, filteredRequest, filteredRequest.ID ? { chargingStationTemplateID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetChargingStationTemplatesAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action,
      filteredRequest: Partial<HttpChargingStationTemplatesGetRequest>): Promise<AuthorizationFilter> {
    const authorizationFilters: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.CHARGING_STATION_TEMPLATE, authAction, authorizationFilters, filteredRequest);
    return authorizationFilters;
  }

  public static async addChargingStationTemplatesAuthorizations(tenant: Tenant, userToken: UserToken, chargingStationTemplates: ChargingStationTemplateDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
  // Add Meta Data
    chargingStationTemplates.metadata = authorizationFilter.metadata;
    // Add Authorizations
    chargingStationTemplates.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION_TEMPLATE, Action.CREATE, authorizationFilter);
    for (const chargingStationTemplate of chargingStationTemplates.result) {
      await AuthorizationService.addChargingStationTemplateAuthorizations(tenant, userToken, chargingStationTemplate, authorizationFilter);
    }
  }

  public static async addChargingStationTemplateAuthorizations(tenant: Tenant, userToken: UserToken, chargingStationTemplate: ChargingStationTemplate,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    chargingStationTemplate.canRead = true; // Always true as it should be filtered upfront
    chargingStationTemplate.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION_TEMPLATE, Action.DELETE, authorizationFilter, { chargingStationTemplateID: chargingStationTemplate.id }, chargingStationTemplate);
    chargingStationTemplate.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION_TEMPLATE, Action.UPDATE, authorizationFilter, { chargingStationTemplateID: chargingStationTemplate.id }, chargingStationTemplate);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(chargingStationTemplate);
  }

  public static async checkAndGetCompaniesAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpCompaniesGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.COMPANY, Action.LIST, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async addCompaniesAuthorizations(tenant: Tenant, userToken: UserToken, companies: CompanyDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    companies.metadata = authorizationFilter.metadata;
    // Add Authorizations
    companies.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.COMPANY, Action.CREATE, authorizationFilter);
    for (const company of companies.result) {
      await AuthorizationService.addCompanyAuthorizations(tenant, userToken, company, authorizationFilter);
    }
  }

  public static async addCompanyAuthorizations(tenant: Tenant, userToken: UserToken, company: Company, authorizationFilter: AuthorizationFilter): Promise<void> {
    company.canRead = true; // Always true as it should be filtered upfront
    company.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.COMPANY, Action.DELETE, authorizationFilter, { CompanyID: company.id }, company);
    company.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.COMPANY, Action.UPDATE, authorizationFilter, { CompanyID: company.id }, company);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(company);
  }

  public static async checkAndGetCompanyAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpCompanyGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.COMPANY, userToken, filteredRequest, filteredRequest.ID ? { CompanyID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetPricingDefinitionsAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpPricingDefinitionsGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.PRICING_DEFINITION, Action.LIST, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async addPricingDefinitionsAuthorizations(tenant: Tenant, userToken: UserToken, pricingDefinitions: PricingDefinitionDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    pricingDefinitions.metadata = authorizationFilter.metadata;
    // Add Authorizations
    pricingDefinitions.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.PRICING_DEFINITION, Action.CREATE, authorizationFilter);
    // Enrich
    for (const pricingDefinition of pricingDefinitions.result) {
      await AuthorizationService.addPricingDefinitionAuthorizations(tenant, userToken, pricingDefinition, authorizationFilter);
    }
  }

  public static async addPricingDefinitionAuthorizations(tenant: Tenant, userToken: UserToken, pricingDefinition: PricingDefinition, filter: AuthorizationFilter): Promise<void> {
    // Enrich
    pricingDefinition.canRead = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.PRICING_DEFINITION, Action.READ, filter, { CompanyID: pricingDefinition.id }, pricingDefinition);
    pricingDefinition.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.PRICING_DEFINITION, Action.DELETE, filter, { CompanyID: pricingDefinition.id }, pricingDefinition);
    pricingDefinition.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.PRICING_DEFINITION, Action.UPDATE, filter, { CompanyID: pricingDefinition.id }, pricingDefinition);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(pricingDefinition);
  }

  public static async checkAndGetPricingDefinitionAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpPricingDefinitionGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.PRICING_DEFINITION, userToken, filteredRequest, filteredRequest.ID ? { PricingID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetSiteAreaAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSiteAreaGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.SITE_AREA, userToken, filteredRequest, filteredRequest.ID ? { SiteAreaID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetSiteAreasAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSiteAreasGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.LIST, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async addSiteAreasAuthorizations(tenant: Tenant, userToken: UserToken, siteAreas: SiteAreaDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    siteAreas.metadata = authorizationFilter.metadata;
    // Add Authorizations
    siteAreas.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.CREATE, authorizationFilter);
    for (const siteArea of siteAreas.result) {
      await AuthorizationService.addSiteAreaAuthorizations(tenant, userToken, siteArea, authorizationFilter);
    }
  }

  public static async addSiteAreaAuthorizations(tenant: Tenant, userToken: UserToken, siteArea: SiteArea, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Downcast & enhance filters with values needed in dynamic filters
    siteArea.canRead = true; // Always true as it should be filtered upfront
    siteArea.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.UPDATE, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
    siteArea.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.DELETE, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
    siteArea.canAssignAssets = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.ASSIGN_ASSETS_TO_SITE_AREA, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
    siteArea.canUnassignAssets = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.UNASSIGN_ASSETS_FROM_SITE_AREA, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
    siteArea.canReadAssets = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.READ_ASSETS_FROM_SITE_AREA, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
    siteArea.canAssignChargingStations = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.ASSIGN_CHARGING_STATIONS_TO_SITE_AREA, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
    siteArea.canUnassignChargingStations = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.UNASSIGN_CHARGING_STATIONS_FROM_SITE_AREA, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
    siteArea.canReadChargingStations = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.READ_CHARGING_STATIONS_FROM_SITE_AREA, authorizationFilter,
      { SiteAreaID: siteArea.id, SiteID: siteArea.siteID, Issuer: siteArea.issuer }, siteArea);
    siteArea.canExportOCPPParams = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.EXPORT_OCPP_PARAMS, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
    siteArea.canGenerateQrCode = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.GENERATE_QR, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(siteArea);
  }

  public static async checkAndGetChargingProfilesAuthorizations(tenant: Tenant, userToken: UserToken,
      authAction: Action, filteredRequest?: HttpChargingProfilesGetRequest, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.CHARGING_PROFILE, authAction,
      authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async addChargingProfilesAuthorizations(tenant: Tenant, userToken: UserToken, chargingProfiles: ChargingProfileDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    chargingProfiles.metadata = authorizationFilter.metadata;
    // Auth
    chargingProfiles.canListChargingStations = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.LIST, authorizationFilter);
    for (const chargingProfile of chargingProfiles.result) {
      await AuthorizationService.addChargingProfileAuthorizations(tenant, userToken, chargingProfile, authorizationFilter);
    }
  }

  public static async addChargingProfileAuthorizations(tenant: Tenant, userToken: UserToken, chargingProfile: ChargingProfile,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    chargingProfile.canRead = true; // Always true as it should be filtered upfront
    chargingProfile.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_PROFILE, Action.UPDATE, authorizationFilter,
      { chargingStationID: chargingProfile.id, SiteAreaID: chargingProfile.chargingStation?.siteAreaID, SiteID: chargingProfile.chargingStation?.siteID }, chargingProfile);
    chargingProfile.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_PROFILE, Action.DELETE, authorizationFilter,
      { chargingStationID: chargingProfile.id, SiteAreaID: chargingProfile.chargingStation?.siteAreaID, SiteID: chargingProfile.chargingStation?.siteID }, chargingProfile);
    chargingProfile.canReadSiteArea = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.READ, authorizationFilter,
      { SiteAreaID: chargingProfile.chargingStation?.siteAreaID, SiteID: chargingProfile.chargingStation?.siteID }, chargingProfile);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(chargingProfile);
  }

  public static async checkAndGetChargingProfileAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpChargingProfileRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(tenant, Entity.CHARGING_PROFILE, userToken, {}, {}, authAction, entityData);
  }


  public static async checkAndGetChargingStationAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpChargingStationGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(tenant, Entity.CHARGING_STATION, userToken, {}, {}, authAction, entityData);
  }

  public static async checkAndGetChargingStationsAuthorizations(tenant: Tenant, userToken: UserToken,
      authAction: Action, filteredRequest?: HttpChargingStationsGetRequest, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.CHARGING_STATION, authAction,
      authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async addChargingStationsAuthorizations(tenant: Tenant, userToken: UserToken, chargingStations: ChargingStationDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    chargingStations.metadata = authorizationFilter.metadata;
    // Auth
    chargingStations.canListCompanies = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.COMPANY, Action.LIST, authorizationFilter);
    chargingStations.canListSites = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE, Action.LIST, authorizationFilter);
    chargingStations.canListSiteAreas = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.LIST, authorizationFilter);
    chargingStations.canListUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.LIST, authorizationFilter);
    chargingStations.canExport = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.EXPORT, authorizationFilter);
    for (const chargingStation of chargingStations.result) {
      await AuthorizationService.addChargingStationAuthorizations(tenant, userToken, chargingStation, authorizationFilter);
    }
  }

  public static async addChargingStationAuthorizations(tenant: Tenant, userToken: UserToken, chargingStation: ChargingStation,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    chargingStation.canRead = true; // Always true as it should be filtered upfront
    chargingStation.canListUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.LIST, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canAuthorize = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.AUTHORIZE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.UPDATE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canUpdateOCPPParams = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.UPDATE_OCPP_PARAMS, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canLimitPower = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.LIMIT_POWER, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canDeleteChargingProfile = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.DELETE_CHARGING_PROFILE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canGetOCPPParams = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GET_OCPP_PARAMS, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canUpdateChargingProfile = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.UPDATE_CHARGING_PROFILE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canGetConnectorQRCode = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GET_CONNECTOR_QR_CODE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.DELETE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canReserveNow = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.RESERVE_NOW, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canReset = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.RESET, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canClearCache = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.CLEAR_CACHE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canGetConfiguration = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GET_CONFIGURATION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canChangeConfiguration = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.CHANGE_CONFIGURATION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canSetChargingProfile = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.SET_CHARGING_PROFILE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canGetCompositeSchedule = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GET_COMPOSITE_SCHEDULE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canClearChargingProfile = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.CLEAR_CHARGING_PROFILE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canGetDiagnostics = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GET_DIAGNOSTICS, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canUpdateFirmware = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.UPDATE_FIRMWARE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canRemoteStopTransaction = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.REMOTE_STOP_TRANSACTION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canStopTransaction = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.STOP_TRANSACTION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canStartTransaction = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.START_TRANSACTION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canChangeAvailability = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.CHANGE_AVAILABILITY, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canRemoteStartTransaction = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.REMOTE_START_TRANSACTION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canUnlockConnector = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.UNLOCK_CONNECTOR, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canDataTransfer = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.TRIGGER_DATA_TRANSFER, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canGenerateQrCode = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GENERATE_QR, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canMaintainPricingDefinitions = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.MAINTAIN_PRICING_DEFINITIONS, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canPushTransactionCDR = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.PUSH_TRANSACTION_CDR, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    chargingStation.canListCompletedTransactions = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.GET_COMPLETED_TRANSACTION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID }, chargingStation);
    // Remote start stop capability using OCPI data (Roaming)
    let hasRemoteStartStopCapability = true;
    if (!chargingStation.issuer) {
      hasRemoteStartStopCapability = false;
      if (!Utils.isNullOrUndefined(chargingStation.ocpiData?.evses)) {
        for (const evse of chargingStation.ocpiData.evses) {
          for (const capability of evse.capabilities) {
            if (capability === OCPICapability.REMOTE_START_STOP_CAPABLE) {
              hasRemoteStartStopCapability = true;
              break;
            }
          }
        }
      }
    }
    // Add connector authorization
    for (const connector of chargingStation.connectors || []) {
      // Start transaction (Auth check should be done first to apply filter)
      connector.canRemoteStopTransaction = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.CONNECTOR, Action.REMOTE_STOP_TRANSACTION,
        authorizationFilter, { chargingStationID: chargingStation.id, UserID: connector.user?.id, SiteID: chargingStation.siteID }, connector)
        && hasRemoteStartStopCapability
        && !chargingStation.inactive
        && [
          ChargePointStatus.CHARGING,
          ChargePointStatus.OCCUPIED,
          ChargePointStatus.SUSPENDED_EV,
          ChargePointStatus.SUSPENDED_EVSE,
        ].includes(connector.status)
        && !!connector.currentTransactionID; // Indicates if transaction is ongoing by known user, otherwise 0
      // Stop transaction (Auth check should be done first to apply filter)
      connector.canRemoteStartTransaction = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.CONNECTOR, Action.REMOTE_START_TRANSACTION, authorizationFilter,
        { chargingStationID: chargingStation.id, UserID: connector.user?.id, SiteID: chargingStation.siteID }, connector)
        && hasRemoteStartStopCapability
        && !chargingStation.inactive
        && !connector.canRemoteStopTransaction
        && [
          ChargePointStatus.AVAILABLE,
          ChargePointStatus.PREPARING,
          ChargePointStatus.RESERVED,
          ChargePointStatus.FINISHING
        ].includes(connector.status)
        && !connector.currentTransactionID; // either no transaction OR transaction is ongoing by an external user
      // Unlock connector
      connector.canUnlockConnector = !chargingStation.inactive
        && chargingStation.canUnlockConnector
        && ![
          ChargePointStatus.AVAILABLE,
          ChargePointStatus.UNAVAILABLE,
        ].includes(connector.status);
      // Read associated transaction: note we force UserID & TagIDs filter
      connector.canReadTransaction = await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.TRANSACTION, Action.READ, authorizationFilter,
        { chargingStationID: chargingStation.id, UserID: connector.user?.id || '', TagIDs: connector.currentTagID || '', SiteID: chargingStation.siteID });
      // Remove sensible data
      await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.CONNECTOR, Action.VIEW_USER_DATA, authorizationFilter,
        { chargingStationID: chargingStation.id, UserID: connector.user?.id, SiteID: chargingStation.siteID, UserData: true, TagData: true }, connector);
      // Remove properties
      Utils.removeCanPropertiesWithFalseValue(connector);
    }
    // Remove sensible data
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.VIEW_USER_DATA, authorizationFilter,
      { chargingStationID: chargingStation.id, UserID: userToken.user?.id, SiteID: chargingStation.siteID, UserData: true, TagData: true }, chargingStation);
    // Remove properties
    Utils.removeCanPropertiesWithFalseValue(chargingStation);
  }

  public static async checkAndGetBillingAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(tenant, Entity.BILLING, userToken, {}, {}, authAction, entityData);
  }

  public static async checkAndGetBillingPlatformAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(tenant, Entity.BILLING_PLATFORM, userToken, {}, {}, authAction, entityData);
  }

  public static async checkAndGetBillingAccountAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpBillingAccountGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.BILLING_ACCOUNT, userToken, filteredRequest, filteredRequest.ID ? { id: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetBillingAccountsAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest?: Partial<HttpBillingAccountsGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(
      tenant, userToken, Entity.BILLING_ACCOUNT, Action.LIST, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetTransfersAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action,
      filteredRequest?: Partial<HttpBillingTransfersGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(
      tenant, userToken, Entity.BILLING_TRANSFER, authAction, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetTransferAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpBillingTransferGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.BILLING_TRANSFER, userToken, filteredRequest, filteredRequest.ID ? { TransferID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetTaxesAuthorizations(tenant: Tenant, userToken: UserToken, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TAX, Action.LIST, authorizations, {}, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetInvoicesAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpBillingInvoicesRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.INVOICE, Action.LIST, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetInvoiceAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpBillingInvoiceRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.INVOICE, userToken, filteredRequest, filteredRequest.ID ? { invoiceID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static addTaxesAuthorizations(tenant: Tenant, userToken: UserToken, billingTaxes: BillingTaxDataResult,
      authorizationFilter: AuthorizationFilter): void {
  // Add Meta Data
    billingTaxes.metadata = authorizationFilter.metadata;
    for (const billingTax of billingTaxes.result) {
      AuthorizationService.addTaxAuthorizations(tenant, userToken, billingTax, authorizationFilter);
    }
  }

  public static addTaxAuthorizations(tenant: Tenant, userToken: UserToken, billingTax: BillingTax, authorizationFilter: AuthorizationFilter): void {
    billingTax.canRead = true; // Always true as it should be filtered upfront
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(billingTax);
  }

  public static async addInvoicesAuthorizations(tenant: Tenant, userToken: UserToken, billingInvoices: BillingInvoiceDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    billingInvoices.metadata = authorizationFilter.metadata;
    billingInvoices.canListUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.LIST, authorizationFilter);
    for (const billingInvoice of billingInvoices.result) {
      await AuthorizationService.addInvoiceAuthorizations(tenant, userToken, billingInvoice, authorizationFilter);
    }
  }

  public static async addInvoiceAuthorizations(tenant: Tenant, userToken: UserToken, billingInvoice: BillingInvoice, authorizationFilter: AuthorizationFilter): Promise<void> {
    billingInvoice.canRead = true; // Always true as it should be filtered upfront
    billingInvoice.canDownload = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.INVOICE, Action.DOWNLOAD, authorizationFilter, billingInvoice.userID ? { UserID: billingInvoice.userID } : {}, billingInvoice);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(billingInvoice);
  }

  public static async addTransfersAuthorizations(tenant: Tenant, userToken: UserToken, billingAccounts: BillingTransfersDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    billingAccounts.metadata = authorizationFilter.metadata;
    billingAccounts.canListAccounts = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.BILLING_ACCOUNT, Action.LIST, authorizationFilter);
    for (const billingAcount of billingAccounts.result) {
      await AuthorizationService.addTransferAuthorizations(tenant, userToken, billingAcount, authorizationFilter);
    }
  }

  public static async addTransferAuthorizations(tenant: Tenant, userToken: UserToken, billingTransfer: BillingTransfer, authorizationFilter: AuthorizationFilter): Promise<void> {
    billingTransfer.canRead = true; // Always true as it should be filtered upfront
    billingTransfer.canDownload = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.BILLING_TRANSFER, Action.DOWNLOAD, authorizationFilter,
      billingTransfer.invoice ? { UserID: billingTransfer.invoice.userID } : {}, billingTransfer);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(billingTransfer);
  }

  public static async addAccountsAuthorizations(tenant: Tenant, userToken: UserToken, billingAccounts: BillingAccountsDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    billingAccounts.metadata = authorizationFilter.metadata;
    billingAccounts.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.BILLING_ACCOUNT, Action.CREATE, authorizationFilter);
    billingAccounts.canListUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.LIST, authorizationFilter);
  }

  public static addAccountAuthorizations(tenant: Tenant, userToken: UserToken, billingAccount: BillingAccount): void {
    // Add Meta Data
    billingAccount.canRead = true;
  }

  public static async checkAndGetPaymentMethodsAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpPaymentMethods>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.PAYMENT_METHOD, Action.LIST, authorizations,
      filteredRequest.userID ? { UserID: filteredRequest.userID } : {}, null, failsWithException);
    return authorizations;
  }

  // EntityData is not usable here, the object is returned via external API call
  public static async checkAndGetPaymentMethodAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpSetupPaymentMethod | HttpDeletePaymentMethod>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.PAYMENT_METHOD, userToken, filteredRequest, filteredRequest.userID ? { UserID: filteredRequest.userID } : {}, authAction, entityData);
  }

  public static async addPaymentMethodsAuthorizations(tenant: Tenant, userToken: UserToken, billingPaymentMethods: BillingPaymentMethodDataResult,
      authorizationFilter: AuthorizationFilter, filteredRequest: Partial<HttpPaymentMethods>): Promise<void> {
    // Add Meta Data
    billingPaymentMethods.metadata = authorizationFilter.metadata;
    // Add Authorizations
    billingPaymentMethods.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.PAYMENT_METHOD, Action.CREATE, authorizationFilter, filteredRequest.userID ? { UserID: filteredRequest.userID } : {});
    for (const billingPaymentMethod of billingPaymentMethods.result) {
      await AuthorizationService.addPaymentMethodAuthorizations(tenant, userToken, billingPaymentMethod, authorizationFilter);
    }
  }

  public static async addPaymentMethodAuthorizations(tenant: Tenant, userToken: UserToken, billingPaymentMethod: BillingPaymentMethod,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    billingPaymentMethod.canRead = true; // Always true as it should be filtered upfront
    // Cannot delete default payment
    billingPaymentMethod.canDelete = !billingPaymentMethod.isDefault && await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.PAYMENT_METHOD, Action.DELETE, authorizationFilter, { billingPaymentMethodID: billingPaymentMethod.id }, billingPaymentMethod);
    // Remove auth flags set to false
    Utils.removeCanPropertiesWithFalseValue(billingPaymentMethod);
  }

  public static async checkAndGetSettingsAuthorizations(tenant: Tenant, userToken: UserToken,
      authAction: Action, filteredRequest: Partial<HttpPaymentMethods>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SETTING, Action.LIST, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetSettingAuthorizations(tenant: Tenant, userToken: UserToken, filteredRequest: Partial<HttpSettingGetRequest>,
      authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.SETTING, userToken, filteredRequest, filteredRequest.ID ? { SettingID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addSettingsAuthorizations(tenant: Tenant, userToken: UserToken, settings: SettingDBDataResult, authorizationFilter: AuthorizationFilter,
      filteredRequest: Partial<HttpSettingsGetRequest>): Promise<void> {
    // Add Meta Data
    settings.metadata = authorizationFilter.metadata;
    // Add Authorizations
    settings.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SETTING, Action.CREATE, authorizationFilter, filteredRequest.Identifier ? { ID: filteredRequest.Identifier } : {});
    for (const setting of settings.result) {
      await AuthorizationService.addSettingAuthorizations(tenant, userToken, setting, authorizationFilter);
    }
  }

  public static async addSettingAuthorizations(tenant: Tenant, userToken: UserToken, setting: Setting, authorizationFilter: AuthorizationFilter): Promise<void> {
    setting.canRead = true; // Always true as it should be filtered upfront
    setting.canUpdate = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SETTING, Action.UPDATE, authorizationFilter);
    setting.canDelete = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SETTING, Action.DELETE, authorizationFilter);
    setting.canSyncRefund = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TRANSACTION,
      Action.SYNCHRONIZE_REFUNDED_TRANSACTION, authorizationFilter);
    setting.canCheckBillingConnection = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.BILLING,
      Action.CHECK_CONNECTION, authorizationFilter);
    setting.canCheckSmartChargingConnection = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SMART_CHARGING,
      Action.CHECK_CONNECTION, authorizationFilter);
    setting.canCheckAssetConnection = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.ASSET,
      Action.CHECK_CONNECTION, authorizationFilter);
    // Remove auth flags set to false
    Utils.removeCanPropertiesWithFalseValue(setting);
  }

  public static async checkAndGetOCPIEndpointsAuthorizations(tenant: Tenant, userToken: UserToken,
      authAction: Action, filteredRequest?: Partial<HttpOCPIEndpointGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.OCPI_ENDPOINT, authAction, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetOCPIEndpointAuthorizations(tenant: Tenant, userToken: UserToken, filteredRequest: Partial<HttpOCPIEndpointGetRequest>,
      authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.OCPI_ENDPOINT, userToken, filteredRequest, filteredRequest.ID ? { OcpiEndpointID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addOCPIEndpointsAuthorizations(tenant: Tenant, userToken: UserToken, ocpiEndpoints: OcpiEndpointDataResult, authorizationFilter: AuthorizationFilter,
      filteredRequest?: Partial<HttpSettingsGetRequest>): Promise<void> {
    // Add Meta Data
    ocpiEndpoints.metadata = authorizationFilter.metadata;
    // Add Authorizations
    ocpiEndpoints.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.OCPI_ENDPOINT, Action.CREATE, authorizationFilter, filteredRequest?.Identifier ? { ID: filteredRequest.Identifier } : {});
    ocpiEndpoints.canGenerateLocalToken = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.OCPI_ENDPOINT, Action.GENERATE_LOCAL_TOKEN, authorizationFilter, filteredRequest?.Identifier ? { ID: filteredRequest.Identifier } : {});
    ocpiEndpoints.canPing = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.OCPI_ENDPOINT, Action.PING, authorizationFilter, filteredRequest?.Identifier ? { ID: filteredRequest.Identifier } : {});
    for (const ocpiEndpoint of ocpiEndpoints.result) {
      await AuthorizationService.addOCPIEndpointAuthorizations(tenant, userToken, ocpiEndpoint, authorizationFilter);
    }
  }

  public static async addOCPIEndpointAuthorizations(tenant: Tenant, userToken: UserToken, ocpiEndpoint: OCPIEndpoint, authorizationFilter: AuthorizationFilter): Promise<void> {
    ocpiEndpoint.canRead = true; // Always true as it should be filtered upfront
    ocpiEndpoint.canUpdate = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.OCPI_ENDPOINT, Action.UPDATE, authorizationFilter);
    ocpiEndpoint.canDelete = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.OCPI_ENDPOINT, Action.DELETE, authorizationFilter);
    ocpiEndpoint.canGenerateLocalToken = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken,
      Entity.OCPI_ENDPOINT, Action.GENERATE_LOCAL_TOKEN, authorizationFilter);
    ocpiEndpoint.canPing = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.OCPI_ENDPOINT, Action.PING, authorizationFilter);
    ocpiEndpoint.canRegister = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.OCPI_ENDPOINT, Action.REGISTER, authorizationFilter);
    ocpiEndpoint.canTriggerJob = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.OCPI_ENDPOINT, Action.TRIGGER_JOB, authorizationFilter);
    // Remove auth flags set to false
    Utils.removeCanPropertiesWithFalseValue(ocpiEndpoint);
  }

  public static async checkAndGetCarsAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpCarsGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CAR, Action.LIST, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetCarAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpCarGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.CAR, userToken, filteredRequest, filteredRequest.ID ? { CarID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addCarsAuthorizations(tenant: Tenant, userToken: UserToken, cars: CarDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    cars.metadata = authorizationFilter.metadata;
    // Add Authorizations
    cars.canCreate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CAR, Action.CREATE, authorizationFilter);
    cars.canListUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.LIST, authorizationFilter);
    cars.canListCarCatalog = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CAR_CATALOG, Action.LIST, authorizationFilter);
    for (const car of cars.result) {
      await AuthorizationService.addCarAuthorizations(tenant, userToken, car, authorizationFilter);
    }
  }

  public static async addCarAuthorizations(tenant: Tenant, userToken: UserToken, car: Car, authorizationFilter: AuthorizationFilter): Promise<void> {
    car.canRead = true; // Always true as it should be filtered upfront
    car.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CAR, Action.DELETE, authorizationFilter, { CarID: car.id }, car);
    car.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CAR, Action.UPDATE, authorizationFilter, { CarID: car.id }, car);
    car.canListUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.LIST, authorizationFilter);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(car);
  }

  public static async checkAndGetCarCatalogsAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action,
      filteredRequest?: Partial<HttpCarCatalogsGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.CAR_CATALOG, authAction,
      authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetCarCatalogAuthorizations(tenant: Tenant, userToken: UserToken, filteredRequest: Partial<HttpCarCatalogGetRequest>,
      authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.CAR_CATALOG, userToken, filteredRequest, filteredRequest.ID ? { CarCatalogID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addCarCatalogsAuthorizationActions(tenant: Tenant, userToken: UserToken, carCatalogs: CarCatalogDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    carCatalogs.metadata = authorizationFilter.metadata;
    // Add Authorizations
    carCatalogs.canSync = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CAR_CATALOG, Action.SYNCHRONIZE, authorizationFilter);
    for (const carCatalog of carCatalogs.result) {
      await AuthorizationService.addCarCatalogAuthorizations(tenant, userToken, carCatalog, authorizationFilter);
    }
  }

  public static async addCarCatalogAuthorizations(tenant: Tenant, userToken: UserToken, carCatalog: CarCatalog, authorizationFilter: AuthorizationFilter): Promise<void> {
    carCatalog.canRead = true; // Always true as it should be filtered upfront
    carCatalog.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CAR_CATALOG, Action.DELETE, authorizationFilter, { CarCatalogID: carCatalog.id }, carCatalog);
    carCatalog.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CAR_CATALOG, Action.UPDATE, authorizationFilter, { CarCatalogID: carCatalog.id }, carCatalog);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(carCatalog);
  }

  public static async checkAndGetTransactionsAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action,
      filteredRequest?: Partial<HttpTransactionConsumptionsGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, authAction, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetTransactionAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpTransactionGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.TRANSACTION, userToken, filteredRequest, filteredRequest.ID ? { TransactionID: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async addTransactionsAuthorizations(tenant: Tenant, userToken: UserToken,
      transactions: TransactionDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    transactions.metadata = authorizationFilter.metadata;
    transactions.canListUsers = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.USER, Action.LIST, authorizationFilter);
    transactions.canListSites = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE, Action.LIST, authorizationFilter);
    transactions.canListSiteAreas = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE_AREA, Action.LIST, authorizationFilter);
    transactions.canListChargingStations = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.CHARGING_STATION, Action.LIST, authorizationFilter);
    transactions.canListTags = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TAG, Action.LIST, authorizationFilter);
    transactions.canExport = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TRANSACTION, Action.EXPORT, authorizationFilter);
    transactions.canDelete = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TRANSACTION, Action.DELETE, authorizationFilter);
    transactions.canSyncRefund = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TRANSACTION, Action.SYNCHRONIZE_REFUNDED_TRANSACTION, authorizationFilter);
    transactions.canRefund = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TRANSACTION, Action.REFUND_TRANSACTION, authorizationFilter);
    transactions.canReadSetting = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SETTING, Action.READ, authorizationFilter);

    // Add Authorizations
    for (const transaction of transactions.result) {
      await AuthorizationService.addTransactionAuthorizations(tenant, userToken, transaction, authorizationFilter);
    }
  }

  public static async addTransactionAuthorizations(tenant: Tenant, userToken: UserToken, transaction: Transaction, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Set entity dynamic auth filters that will be used by auth framework
    const dynamicAuthorizationFilter: DynamicAuthorizationsFilter = { CompanyID: transaction.companyID, SiteID: transaction.siteID, UserID: transaction.userID };
    transaction.canRead = true; // Always true as it should be filtered upfront
    transaction.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.DELETE,
      authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction);
    transaction.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.UPDATE,
      authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction);
    transaction.canSynchronizeRefundedTransaction = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.SYNCHRONIZE_REFUNDED_TRANSACTION,
      authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction);
    transaction.canGetAdvenirConsumption = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.GET_ADVENIR_CONSUMPTION,
      authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction);
    transaction.canRemoteStopTransaction = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.REMOTE_STOP_TRANSACTION,
      authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction);
    transaction.canListLogs = await this.canPerformAuthorizationAction(tenant, userToken, Entity.LOGGING, Action.LIST,
      authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction);
    transaction.canListLogs = await this.canPerformAuthorizationAction(tenant, userToken, Entity.LOGGING, Action.LIST,
      authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction);
    transaction.canReadChargingStation = await this.canPerformAuthorizationAction(tenant, userToken, Entity.CHARGING_STATION, Action.READ,
      authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction);
    // Additional auth check for refund
    transaction.canRefundTransaction = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.REFUND_TRANSACTION,
      authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction)
      && !(transaction.refundData && !!transaction.refundData.refundId && transaction.refundData.status !== RefundStatus.CANCELLED);
    // Additional check for PushTransactionCDR
    transaction.canPushTransactionCDR = transaction.ocpi
      && !transaction.ocpiWithCdr
      && await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.TRANSACTION, Action.PUSH_TRANSACTION_CDR,
        authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction);
    // Additional check for ExportOcpiCdr
    transaction.canExportOcpiCdr = transaction.ocpi
      && transaction.ocpiWithCdr
      && await AuthorizationService.canPerformAuthorizationAction(
        tenant, userToken, Entity.TRANSACTION, Action.EXPORT_OCPI_CDR,
        authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction);
    // Set sensible data
    const sensibleUserData = { UserData: true, TagData: true, CarCatalogData: true, CarData: true, BillingData: true };
    // Transaction sensible data
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.VIEW_USER_DATA, authorizationFilter,
      { TransactionID: transaction.id, ...dynamicAuthorizationFilter, ...sensibleUserData }, transaction);
    // Transaction.stop sensible data
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.VIEW_USER_DATA, authorizationFilter,
      { TransactionID: transaction.id, ...dynamicAuthorizationFilter, ...sensibleUserData }, transaction.stop);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(transaction);
  }

  public static async addTransactionsInErrorAuthorizations(tenant: Tenant, userToken: UserToken,
      transactions: TransactionInErrorDataResult, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    transactions.metadata = authorizationFilter.metadata;
    // Add Meta Data
    transactions.metadata = authorizationFilter.metadata;
    transactions.canListUsers = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.USER, Action.LIST, authorizationFilter);
    transactions.canListSites = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE, Action.LIST, authorizationFilter);
    transactions.canListSiteAreas = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.SITE_AREA, Action.LIST, authorizationFilter);
    transactions.canListChargingStations = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.CHARGING_STATION, Action.LIST, authorizationFilter);
    transactions.canListTags = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TAG, Action.LIST, authorizationFilter);
    transactions.canExport = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TRANSACTION, Action.EXPORT, authorizationFilter);
    transactions.canDelete = await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.TRANSACTION, Action.DELETE, authorizationFilter);
    // Add Authorizations
    for (const transaction of transactions.result) {
      await AuthorizationService.addTransactionInErrorAuthorizations(tenant, userToken, transaction, authorizationFilter);
    }
  }

  public static async addTransactionInErrorAuthorizations(tenant: Tenant, userToken: UserToken, transaction: TransactionInError,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Set entity dynamic auth filters that will be used by auth framework
    const dynamicAuthorizationFilter: DynamicAuthorizationsFilter = { CompanyID: transaction.companyID, SiteID: transaction.siteID, UserID: transaction.userID };
    transaction.canRead = true; // Always true as it should be filtered upfront
    transaction.canListLogs = await this.canPerformAuthorizationAction(tenant, userToken, Entity.LOGGING, Action.LIST,
      authorizationFilter, { TransactionID: transaction.id, ...dynamicAuthorizationFilter }, transaction);
    // Check and remove sensible data
    const sensibleUserData = { UserData: true, TagData: true, CarCatalogData: true, CarData: true, BillingData: true };
    // Transaction sensible data
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.VIEW_USER_DATA, authorizationFilter,
      { TransactionID: transaction.id, ...dynamicAuthorizationFilter, ...sensibleUserData }, transaction);
    // Transaction stop sensible data
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.VIEW_USER_DATA, authorizationFilter,
      { TransactionID: transaction.id, ...dynamicAuthorizationFilter, ...sensibleUserData }, transaction.stop);
    // Optimize data
    Utils.removeCanPropertiesWithFalseValue(transaction);
  }

  public static async addRefundReportsAuthorizations(tenant: Tenant, userToken: UserToken,
      refundReports: RefundReport[], authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Authorizations
    for (const refundReport of refundReports) {
      await AuthorizationService.addRefundReportAuthorizations(tenant, userToken, refundReport, authorizationFilter);
    }
  }

  public static async addRefundReportAuthorizations(tenant: Tenant, userToken: UserToken, refundReport: RefundReport, authorizationFilter: AuthorizationFilter): Promise<void> {
    // Check and remove sensible data
    const sensibleUserData = { UserData: true, TagData: true };
    // Refund report sensible data (Based on the Transaction)
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.TRANSACTION, Action.VIEW_USER_DATA, authorizationFilter, { ...sensibleUserData }, refundReport);
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(refundReport);
  }

  public static async checkAndGetConsumptionsAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action,
      filteredRequest?: Partial<HttpByIDRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CONSUMPTION, authAction, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetSmartChargingAuthorizations(tenant: Tenant, userToken: UserToken,
      authAction: Action, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.SMART_CHARGING, authAction,
      authorizations, {}, null, failsWithException);
    return authorizations;
  }

  private static filterProjectFields(authFields: string[], httpProjectField: string): string[] {
    // Init with authorization fields
    let applicableProjectedFields = authFields;
    // Remove '*'
    if (!Utils.isEmptyArray(applicableProjectedFields)) {
      applicableProjectedFields = applicableProjectedFields.filter((field) => field !== '*');
    }
    // Build and clean http projected field to only contain authorized fields
    let httpProjectFields = AuthorizationService.httpFilterProjectToArray(httpProjectField);
    if (!Utils.isEmptyArray(applicableProjectedFields) && !Utils.isEmptyArray(httpProjectFields)) {
      httpProjectFields = httpProjectFields.filter(
        (httpProjectField) => applicableProjectedFields.includes(httpProjectField));
    }
    if (!Utils.isEmptyArray(httpProjectFields)) {
      return httpProjectFields;
    }
    return applicableProjectedFields;
  }

  private static async processDynamicFilters(tenant: Tenant, userToken: UserToken, authAction: Action, authEntity: Entity,
      authorizationFilters: AuthorizationFilter, authorizationContext: AuthorizationContext,
      extraFilters?: Record<string, any>, entityData?: EntityData): Promise<void> {
    if (!Utils.isEmptyArray(authorizationContext.filters)) {
      // First array is an AND between filters
      for (let filtersToProcess of authorizationContext.filters) {
        authorizationFilters.authorized = false;
        // Array?
        if (!Array.isArray(filtersToProcess)) {
          filtersToProcess = [filtersToProcess];
        }
        let authorized = false;
        // Second array is an OR between filters
        for (const filterToProcess of filtersToProcess) {
          // Get the filter
          const dynamicFilter = await DynamicAuthorizationFactory.getDynamicFilter(
            tenant, userToken, filterToProcess, authorizationFilters.dataSources);
          if (!dynamicFilter) {
            // Filter not found -> Not authorized (all auth filter MUST work)
            throw new AppAuthError({
              errorCode: HTTPAuthError.FORBIDDEN,
              user: userToken,
              action: authAction, entity: authEntity,
              module: MODULE_NAME, method: 'processDynamicFilters'
            });
          }
          // Process the filter
          dynamicFilter.processFilter(authorizationFilters, extraFilters, entityData);
          // Negate the filter
          if (dynamicFilter.isNegateFilter()) {
            authorizationFilters.authorized = !authorizationFilters.authorized;
          }
          authorized = authorized || authorizationFilters.authorized;
        }
        // Assign
        authorizationFilters.authorized = authorized;
        // Failed?
        if (!authorizationFilters.authorized) {
          return;
        }
      }
    }
  }

  private static processDynamicAsserts(tenant: Tenant, userToken: UserToken, authAction: Action, authEntity: Entity,
      authorizationFilters: AuthorizationFilter, authorizationContext: AuthorizationContext, entityData?: EntityData): void {
    if (entityData && !Utils.isEmptyArray(authorizationContext.asserts)) {
      // First array is an AND between assertions
      for (let assertsToProcess of authorizationContext.asserts) {
        authorizationFilters.authorized = false;
        // Array?
        if (!Array.isArray(assertsToProcess)) {
          assertsToProcess = [assertsToProcess];
        }
        let authorized = false;
        // Second array is an OR between assertions
        for (const assertToProcess of assertsToProcess) {
          // Get the assertion
          const dynamicAssert = DynamicAuthorizationFactory.getDynamicAssert(
            tenant, userToken, assertToProcess);
          if (!dynamicAssert) {
            // Assertion not found -> Not authorized (all auth filter MUST work)
            throw new AppAuthError({
              errorCode: HTTPAuthError.FORBIDDEN,
              user: userToken,
              action: authAction, entity: authEntity,
              module: MODULE_NAME, method: 'processDynamicAsserts'
            });
          }
          // Process the assertion
          authorizationFilters.authorized = dynamicAssert.processAssert(entityData);
          // Negate the assertion
          if (dynamicAssert.isNegateAssert()) {
            authorizationFilters.authorized = !authorizationFilters.authorized;
          }
          authorized = authorized || authorizationFilters.authorized;
        }
        // Assign
        authorizationFilters.authorized = authorized;
        // Failed?
        if (!authorizationFilters.authorized) {
          return;
        }
      }
    }
  }

  private static async canPerformAuthorizationAction(tenant: Tenant, userToken: UserToken,
      authEntity: Entity, authAction: Action, authorizationFilters: AuthorizationFilter,
      filteredRequest?: Record<string, any>, entityData?: EntityData, failsWithException = false): Promise<boolean> {
    // Check static auth
    const authorizationContext: AuthorizationContext = {};
    const authResult = await Authorizations.can(userToken, authEntity, authAction, authorizationContext);
    authorizationFilters.authorized = authResult.authorized;
    if (!authorizationFilters.authorized) {
      if (failsWithException) {
        throw new AppAuthError({
          errorCode: HTTPAuthError.FORBIDDEN,
          user: userToken,
          action: authAction, entity: authEntity,
          module: MODULE_NAME, method: 'canPerformAuthorizationAction',
        });
      }
      return false;
    }
    // Process Dynamic Filters
    await AuthorizationService.processDynamicFilters(tenant, userToken, authAction, authEntity,
      authorizationFilters, authorizationContext, filteredRequest, entityData);
    if (authorizationFilters.authorized) {
      // Keep the Meta Data
      authorizationFilters.metadata = authResult.context.metadata;
      // Process Dynamic Assertions
      AuthorizationService.processDynamicAsserts(tenant, userToken, authAction, authEntity,
        authorizationFilters, authorizationContext, entityData);
    }
    // Filter projected fields
    authorizationFilters.projectFields = AuthorizationService.filterProjectFields(
      authResult.fields, filteredRequest?.ProjectFields);
    return authorizationFilters.authorized;
  }

  private static async checkAndGetEntityAuthorizations(tenant: Tenant, authEntity: Entity, userToken: UserToken,
      filteredRequest: Record<string, any>, entityID: Record<string, any>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check Static Auths
    const authorizationContext: AuthorizationContext = {};
    const authResult = await Authorizations.can(userToken, authEntity, authAction, authorizationContext);
    authorizations.authorized = authResult.authorized;
    if (!authorizations.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: userToken,
        action: authAction, entity: authEntity,
        module: MODULE_NAME, method: 'checkAndGetEntityAuthorizations',
      });
    }
    // Process Dynamic Filters
    await AuthorizationService.processDynamicFilters(tenant, userToken, authAction, authEntity,
      authorizations, authorizationContext, entityID, entityData);
    if (!authorizations.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: userToken,
        action: authAction, entity: authEntity,
        module: MODULE_NAME, method: 'checkAndGetEntityAuthorizations',
      });
    }
    // Keep the Meta Data
    authorizations.metadata = authResult.context.metadata;
    // Process Dynamic Assertions
    AuthorizationService.processDynamicAsserts(tenant, userToken, authAction, authEntity,
      authorizations, authorizationContext, entityData);
    if (!authorizations.authorized) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: userToken,
        action: authAction, entity: authEntity,
        module: MODULE_NAME, method: 'checkAndGetEntityAuthorizations',
      });
    }
    // Filter projected fields
    authorizations.projectFields = AuthorizationService.filterProjectFields(authResult.fields,
      filteredRequest.ProjectFields);
    return authorizations;
  }

  private static httpFilterProjectToArray(httpProjectFields: string): string[] {
    if (httpProjectFields) {
      return httpProjectFields.split('|');
    }
  }
}
