import { Action, AuthorizationActions, AuthorizationContext, AuthorizationFilter, Entity } from '../../../../types/Authorization';
import { AssetDataResult, BillingInvoiceDataResult, BillingPaymentMethodDataResult, BillingSubaccountsDataResult, BillingTaxDataResult, BillingTransfersDataResult, CarCatalogDataResult, CarDataResult, ChargingProfileDataResult, ChargingStationDataResult, CompanyDataResult, DataResult, LogDataResult, PricingDefinitionDataResult, RegistrationTokenDataResult, SiteAreaDataResult, SiteDataResult, TagDataResult, UserDataResult } from '../../../../types/DataResult';
import { BillingAccount, BillingInvoice, BillingPaymentMethod, BillingTax } from '../../../../types/Billing';
import { Car, CarCatalog } from '../../../../types/Car';
import { ChargePointStatus, OCPPProtocol, OCPPVersion } from '../../../../types/ocpp/OCPPServer';
import { HttpAssetGetRequest, HttpAssetsGetRequest } from '../../../../types/requests/HttpAssetRequest';
import { HttpBillingInvoiceRequest, HttpBillingInvoicesRequest, HttpBillingSubAccountGetRequest, HttpBillingSubAccountsGetRequest, HttpBillingTransfersGetRequest, HttpDeletePaymentMethod, HttpPaymentMethods, HttpSetupPaymentMethod } from '../../../../types/requests/HttpBillingRequest';
import { HttpCarCatalogGetRequest, HttpCarCatalogsGetRequest, HttpCarGetRequest, HttpCarsGetRequest } from '../../../../types/requests/HttpCarRequest';
import { HttpChargingProfileRequest, HttpChargingProfilesGetRequest, HttpChargingStationGetRequest, HttpChargingStationsGetRequest } from '../../../../types/requests/HttpChargingStationRequest';
import { HttpCompaniesGetRequest, HttpCompanyGetRequest } from '../../../../types/requests/HttpCompanyRequest';
import { HttpPricingDefinitionGetRequest, HttpPricingDefinitionsGetRequest } from '../../../../types/requests/HttpPricingRequest';
import { HttpSiteAreaGetRequest, HttpSiteAreasGetRequest } from '../../../../types/requests/HttpSiteAreaRequest';
import { HttpSiteAssignUsersRequest, HttpSiteGetRequest, HttpSiteUsersRequest } from '../../../../types/requests/HttpSiteRequest';
import { HttpTagGetRequest, HttpTagsGetRequest } from '../../../../types/requests/HttpTagRequest';
import { HttpUserGetRequest, HttpUserSitesAssignRequest, HttpUserSitesGetRequest, HttpUsersGetRequest } from '../../../../types/requests/HttpUserRequest';
import Tenant, { TenantComponents } from '../../../../types/Tenant';
import User, { UserRole } from '../../../../types/User';

import AppAuthError from '../../../../exception/AppAuthError';
import Asset from '../../../../types/Asset';
import Authorizations from '../../../../authorization/Authorizations';
import { ChargingProfile } from '../../../../types/ChargingProfile';
import ChargingStation from '../../../../types/ChargingStation';
import Company from '../../../../types/Company';
import DynamicAuthorizationFactory from '../../../../authorization/DynamicAuthorizationFactory';
import { EntityData } from '../../../../types/GlobalType';
import { HTTPAuthError } from '../../../../types/HTTPError';
import { HttpLogGetRequest } from '../../../../types/requests/HttpLogRequest';
import { HttpRegistrationTokenGetRequest } from '../../../../types/requests/HttpRegistrationToken';
import { Log } from '../../../../types/Log';
import Logging from '../../../../utils/Logging';
import PricingDefinition from '../../../../types/Pricing';
import RegistrationToken from '../../../../types/RegistrationToken';
import { ServerAction } from '../../../../types/Server';
import { Setting } from '../../../../types/Setting';
import Site from '../../../../types/Site';
import SiteArea from '../../../../types/SiteArea';
import Tag from '../../../../types/Tag';
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
    site.canAssignUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USERS_SITES, Action.ASSIGN, authorizationFilter, { SiteID: site.id }, site);
    site.canUnassignUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USERS_SITES, Action.UNASSIGN, authorizationFilter, { SiteID: site.id }, site);
    site.canReadUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USERS_SITES, Action.READ, authorizationFilter, { SiteID: site.id }, site);
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
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.USERS_SITES, Action.LIST,
      authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetUserSitesAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpUserSitesGetRequest>): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [
        'site.id', 'site.name', 'site.address.city', 'site.address.country', 'siteAdmin', 'siteOwner', 'userID'
      ],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Filter projected fields
    authorizations.projectFields = AuthorizationService.filterProjectFields(authorizations.projectFields, filteredRequest.ProjectFields);
    // Handle Sites
    await AuthorizationService.checkAssignedSiteAdminsAndOwners(tenant, userToken, null, authorizations);
    return authorizations;
  }

  public static async checkAssignSiteUsersAuthorizations(tenant: Tenant, action: ServerAction, userToken: UserToken,
      filteredRequest: Partial<HttpSiteAssignUsersRequest>): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    const authAction = action === ServerAction.ADD_USERS_TO_SITE ? Action.ASSIGN : Action.UNASSIGN;
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.USERS_SITES, authAction,
      authorizations, filteredRequest, null, true);
    return authorizations;
  }

  public static async checkAndAssignUserSitesAuthorizations(
      tenant: Tenant, action: ServerAction, userToken: UserToken,
      filteredRequest: Partial<HttpUserSitesAssignRequest>): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: userToken.role === UserRole.ADMIN,
    };
    // Check static & dynamic authorization
    const authAction = action === ServerAction.ADD_USERS_TO_SITE ? Action.ASSIGN : Action.UNASSIGN;
    await this.canPerformAuthorizationAction(tenant, userToken, Entity.USERS_SITES, authAction,
      authorizations, filteredRequest, null, true);
    return authorizations;
  }

  public static async checkAndGetUsersInErrorAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpUsersGetRequest>): Promise<AuthorizationFilter> {
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
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(user);
  }

  public static async checkAndGetUsersAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpUsersGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false,
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.LIST, authorizations, filteredRequest, null, failsWithException);
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
      tenant, userToken, Entity.SITE_AREA, Action.DELETE, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
    siteArea.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.UPDATE, authorizationFilter, { SiteAreaID: siteArea.id, SiteID: siteArea.siteID }, siteArea);
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
      tenant, userToken, Entity.CHARGING_PROFILE, Action.UPDATE, authorizationFilter, { chargingStationID: chargingProfile.id }, chargingProfile);
    chargingProfile.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_PROFILE, Action.DELETE, authorizationFilter, { chargingStationID: chargingProfile.id }, chargingProfile);
    chargingProfile.canReadSiteArea = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SITE_AREA, Action.READ, authorizationFilter,
      { SiteAreaID: chargingProfile.chargingStation?.siteArea.id, SiteID: chargingProfile.chargingStation?.siteID }, chargingProfile);
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
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.UPDATE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canUpdateOCPPParams = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.UPDATE_OCPP_PARAMS, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canLimitPower = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.LIMIT_POWER, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canDeleteChargingProfile = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.DELETE_CHARGING_PROFILE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canGetOCPPParams = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GET_OCPP_PARAMS, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canUpdateChargingProfile = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.UPDATE_CHARGING_PROFILE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canGetConnectorQRCode = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GET_CONNECTOR_QR_CODE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canDelete = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.DELETE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canReserveNow = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.RESERVE_NOW, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canReset = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.RESET, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canClearCache = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.CLEAR_CACHE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canGetConfiguration = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GET_CONFIGURATION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canChangeConfiguration = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.CHANGE_CONFIGURATION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canSetChargingProfile = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.SET_CHARGING_PROFILE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canGetCompositeSchedule = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GET_COMPOSITE_SCHEDULE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canClearChargingProfile = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.CLEAR_CHARGING_PROFILE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canGetDiagnostics = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GET_DIAGNOSTICS, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canUpdateFirmware = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.UPDATE_FIRMWARE, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canRemoteStopTransaction = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.REMOTE_STOP_TRANSACTION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canStopTransaction = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.STOP_TRANSACTION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canStarTransaction = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.START_TRANSACTION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canChangeAvailability = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.CHANGE_AVAILABILITY, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canRemoteStartTransaction = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.REMOTE_START_TRANSACTION, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canUnlockConnector = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.UNLOCK_CONNECTOR, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canDataTransfer = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.TRIGGER_DATA_TRANSFER, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canGenerateQrCode = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.GENERATE_QR, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    chargingStation.canMaintainPricingDefinitions = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.CHARGING_STATION, Action.MAINTAIN_PRICING_DEFINITIONS, authorizationFilter,
      { chargingStationID: chargingStation.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, chargingStation);
    // Add connector authorization
    for (const connector of chargingStation.connectors) {
      // Start transaction
      connector.canRemoteStopTransaction = !chargingStation.inactive
        && [
          ChargePointStatus.CHARGING,
          ChargePointStatus.OCCUPIED,
          ChargePointStatus.SUSPENDED_EV,
          ChargePointStatus.SUSPENDED_EVSE,
        ].includes(connector.status)
        && !!connector.currentTransactionID // Indicates if transaction is ongoing by known user, otherwise 0
        && await AuthorizationService.canPerformAuthorizationAction(tenant, userToken, Entity.CONNECTOR, Action.REMOTE_STOP_TRANSACTION, authorizationFilter,
          { chargingStationID: chargingStation.id, UserID: connector.user?.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, connector);
      // Stop transaction
      connector.canRemoteStartTransaction = !chargingStation.inactive
        && !connector.canRemoteStopTransaction
        && [
          ChargePointStatus.AVAILABLE,
          ChargePointStatus.PREPARING,
          ChargePointStatus.RESERVED,
        ].includes(connector.status)
        && !connector.currentTransactionID // either no transaction OR transaction is ongoing by an external user
        && await AuthorizationService.canPerformAuthorizationAction(
          tenant, userToken, Entity.CONNECTOR, Action.REMOTE_START_TRANSACTION, authorizationFilter,
          { chargingStationID: chargingStation.id, UserID: connector.user?.id, SiteID: chargingStation.siteID, Issuer: chargingStation.issuer }, connector);
      // Unlock connector
      connector.canUnlockConnector = !chargingStation.inactive
        && chargingStation.canUnlockConnector
        && [
          ChargePointStatus.FINISHING,
          ChargePointStatus.FAULTED,
          ChargePointStatus.SUSPENDED_EVSE,
        ].includes(connector.status);
      Utils.removeCanPropertiesWithFalseValue(connector);
    }
    // Optimize data over the net
    Utils.removeCanPropertiesWithFalseValue(chargingStation);
  }

  public static async checkAndGetBillingAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(tenant, Entity.BILLING, userToken, {}, {}, authAction, entityData);
  }

  public static async checkAndGetBillingPlatformAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(tenant, Entity.BILLING_PLATFORM, userToken, {}, {}, authAction, entityData);
  }

  public static async checkAndGetBillingSubAccountAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest: Partial<HttpBillingSubAccountGetRequest>, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(
      tenant, Entity.BILLING_SUB_ACCOUNT, userToken, filteredRequest, filteredRequest.ID ? { id: filteredRequest.ID } : {}, authAction, entityData);
  }

  public static async checkAndGetBillingSubAccountsAuthorizations(tenant: Tenant, userToken: UserToken,
      filteredRequest?: Partial<HttpBillingSubAccountsGetRequest>, failsWithException = true): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await this.canPerformAuthorizationAction(
      tenant, userToken, Entity.BILLING_SUB_ACCOUNT, Action.LIST, authorizations, filteredRequest, null, failsWithException);
    return authorizations;
  }

  public static async checkAndGetBillingTransfersAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action,
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

  public static async addSubAccountsAuthorizations(tenant: Tenant, userToken: UserToken, billingSubAccounts: BillingSubaccountsDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    billingSubAccounts.metadata = authorizationFilter.metadata;
    billingSubAccounts.canListUsers = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.USER, Action.LIST, authorizationFilter);
  }

  public static addSubAccountAuthorizations(tenant: Tenant, userToken: UserToken, billingSubAccount: BillingAccount): void {
    // Add Meta Data
    billingSubAccount.canRead = true;
  }

  public static async addTransfersAuthorizations(tenant: Tenant, userToken: UserToken, billingSubAccounts: BillingTransfersDataResult,
      authorizationFilter: AuthorizationFilter): Promise<void> {
  // Add Meta Data
    billingSubAccounts.metadata = authorizationFilter.metadata;
    billingSubAccounts.canListSubAccounts = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.BILLING_SUB_ACCOUNT, Action.LIST, authorizationFilter);
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

  public static async checkAndGetSettingsAuthorizations(tenant: Tenant, userToken: UserToken): Promise<AuthorizationFilter> {
    const authorizations: AuthorizationFilter = {
      filters: {},
      dataSources: new Map(),
      projectFields: [],
      authorized: false
    };
    // Check static & dynamic authorization
    await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SETTING, Action.LIST, authorizations, null, null, true);
    return authorizations;
  }

  public static async checkAndGetSettingAuthorizations(tenant: Tenant, userToken: UserToken, authAction: Action, entityData?: EntityData): Promise<AuthorizationFilter> {
    return AuthorizationService.checkAndGetEntityAuthorizations(tenant, Entity.SETTING, userToken, {}, null, authAction, entityData);
  }

  public static async addSettingsAuthorizations(tenant: Tenant, userToken: UserToken, settings: DataResult<Setting>,
      authorizationFilter: AuthorizationFilter): Promise<void> {
    // Add Meta Data
    settings.metadata = authorizationFilter.metadata;
    for (const setting of settings.result) {
      await AuthorizationService.addSettingAuthorizations(tenant, userToken, setting, authorizationFilter);
    }
  }

  public static async addSettingAuthorizations(tenant: Tenant, userToken: UserToken, setting: Setting, authorizationFilter: AuthorizationFilter): Promise<void> {
    setting.canRead = true; // Always true as it should be filtered upfront
    setting.canUpdate = await AuthorizationService.canPerformAuthorizationAction(
      tenant, userToken, Entity.SETTING, Action.UPDATE, authorizationFilter);
    // Remove auth flags set to false
    Utils.removeCanPropertiesWithFalseValue(setting);
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

  private static async checkAssignedSites(tenant: Tenant, userToken: UserToken,
      filteredRequest: { SiteID?: string }, authorizationFilters: AuthorizationFilter): Promise<void> {
    if (userToken.role !== UserRole.ADMIN && userToken.role !== UserRole.SUPER_ADMIN) {
      if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
        // Get assigned Site IDs assigned to user from DB
        const siteIDs = await Authorizations.getAssignedSiteIDs(tenant, userToken);
        if (!Utils.isEmptyArray(siteIDs)) {
          // Force the filter
          authorizationFilters.filters.siteIDs = siteIDs;
          // Check if filter is provided
          if (filteredRequest?.SiteID) {
            const filteredSiteIDs = filteredRequest.SiteID.split('|');
            // Override
            authorizationFilters.filters.siteIDs = filteredSiteIDs.filter(
              (siteID) => authorizationFilters.filters.siteIDs.includes(siteID));
          }
        }
        if (!Utils.isEmptyArray(authorizationFilters.filters.siteIDs)) {
          authorizationFilters.authorized = true;
        }
      } else {
        authorizationFilters.authorized = true;
      }
    }
  }

  private static async checkAssignedSiteAdminsAndOwners(tenant: Tenant, userToken: UserToken,
      filteredRequest: { SiteID?: string }, authorizationFilters: AuthorizationFilter): Promise<void> {
    if (userToken.role !== UserRole.ADMIN && userToken.role !== UserRole.SUPER_ADMIN) {
      if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
        // Get Site IDs from Site Admin & Site Owner flag
        const siteAdminSiteIDs = await Authorizations.getSiteAdminSiteIDs(tenant, userToken);
        const siteOwnerSiteIDs = await Authorizations.getSiteOwnerSiteIDs(tenant, userToken);
        const allSites = _.uniq([...siteAdminSiteIDs, ...siteOwnerSiteIDs]);
        if (!Utils.isEmptyArray(allSites)) {
          // Force the filters
          authorizationFilters.filters.siteIDs = allSites;
          // Check if filter is provided
          if (filteredRequest?.SiteID) {
            const filteredSiteIDs: string[] = filteredRequest.SiteID.split('|');
            // Override
            authorizationFilters.filters.siteIDs = filteredSiteIDs.filter(
              (filteredSiteID) => authorizationFilters.filters.siteIDs.includes(filteredSiteID));
          }
        }
        if (!Utils.isEmptyArray(authorizationFilters.filters.siteIDs)) {
          authorizationFilters.authorized = true;
        }
      } else {
        authorizationFilters.authorized = true;
      }
    }
  }

  private static filterProjectFields(authFields: string[], httpProjectField: string): string[] {
    let fields = authFields;
    // Only allow projected fields
    const httpProjectFields = AuthorizationService.httpFilterProjectToArray(httpProjectField);
    if (!Utils.isEmptyArray(httpProjectFields)) {
      fields = authFields.filter(
        (authField) => httpProjectFields.includes(authField));
    }
    // Remove '*'
    if (!Utils.isEmptyArray(fields)) {
      fields = fields.filter((field) => field !== '*');
    }
    return fields;
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

  private static async processDynamicAsserts(tenant: Tenant, userToken: UserToken, authAction: Action, authEntity: Entity,
      authorizationFilters: AuthorizationFilter, authorizationContext: AuthorizationContext, entityData?: EntityData): Promise<void> {
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
          if (!authorizationFilters.authorized) {
            await Logging.logError({
              tenantID: tenant.id,
              user: userToken,
              module: MODULE_NAME, method: 'processDynamicAsserts',
              message: `Dynamic Authorization '${assertToProcess}' did not allow to perform '${authAction}' on '${authEntity}'`,
              action: ServerAction.AUTHORIZATIONS
            });
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
      await AuthorizationService.processDynamicAsserts(tenant, userToken, authAction, authEntity,
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
    await AuthorizationService.processDynamicAsserts(tenant, userToken, authAction, authEntity,
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
