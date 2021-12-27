import { NextFunction, Request, Response } from 'express';

import AssetService from './v1/service/AssetService';
import BillingService from './v1/service/BillingService';
import CarService from './v1/service/CarService';
import ChargingStationService from './v1/service/ChargingStationService';
import CompanyService from './v1/service/CompanyService';
import ConnectionService from './v1/service/ConnectionService';
import Logging from '../../utils/Logging';
import LoggingService from './v1/service/LoggingService';
import NotificationService from './v1/service/NotificationService';
import OCPIEndpointService from './v1/service/OCPIEndpointService';
import OICPEndpointService from './v1/service/OICPEndpointService';
import RegistrationTokenService from './v1/service/RegistrationTokenService';
import { ServerAction } from '../../types/Server';
import SettingService from './v1/service/SettingService';
import SiteAreaService from './v1/service/SiteAreaService';
import SiteService from './v1/service/SiteService';
import StatisticService from './v1/service/StatisticService';
import { StatusCodes } from 'http-status-codes';
import TagService from './v1/service/TagService';
import TenantService from './v1/service/TenantService';
import TransactionService from './v1/service/TransactionService';
import UserService from './v1/service/UserService';
import UtilsService from './v1/service/UtilsService';

class RequestMapper {
  private static instances = new Map<string, RequestMapper>();
  private paths = new Map<string, number>();
  private actions = new Array<(action: ServerAction, req: Request, res: Response, next: NextFunction) => void|Promise<void>>();

  private constructor(httpVerb: string) {
    switch (httpVerb) {
      // Create
      case 'POST':
        // Register REST actions
        this.registerJsonActionsPaths({
          [ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA]: SiteAreaService.handleAssignChargingStationsToSiteArea.bind(this),
          [ServerAction.REMOVE_CHARGING_STATIONS_FROM_SITE_AREA]: SiteAreaService.handleAssignChargingStationsToSiteArea.bind(this),
          [ServerAction.REGISTRATION_TOKEN_CREATE]: RegistrationTokenService.handleCreateRegistrationToken.bind(this),
          [ServerAction.COMPANY_CREATE]: CompanyService.handleCreateCompany.bind(this),
          [ServerAction.ADD_ASSET_TO_SITE_AREA]: SiteAreaService.handleAssignAssetsToSiteArea.bind(this),
          [ServerAction.REMOVE_ASSET_TO_SITE_AREA]: SiteAreaService.handleAssignAssetsToSiteArea.bind(this),
          [ServerAction.ASSET_CREATE]: AssetService.handleCreateAsset.bind(this),
          [ServerAction.TENANT_CREATE]: TenantService.handleCreateTenant.bind(this),
          [ServerAction.SITE_CREATE]: SiteService.handleCreateSite.bind(this),
          [ServerAction.ADD_USERS_TO_SITE]: SiteService.handleAssignUsersToSite.bind(this),
          [ServerAction.REMOVE_USERS_FROM_SITE]: SiteService.handleAssignUsersToSite.bind(this),
          [ServerAction.SITE_AREA_CREATE]: SiteAreaService.handleCreateSiteArea.bind(this),
          [ServerAction.TRANSACTIONS_REFUND]: TransactionService.handleRefundTransactions.bind(this),
          [ServerAction.TRANSACTION_PUSH_CDR]: TransactionService.handlePushTransactionCdr.bind(this),
          [ServerAction.SYNCHRONIZE_REFUNDED_TRANSACTIONS]: TransactionService.handleSynchronizeRefundedTransactions.bind(this),
          [ServerAction.SETTING_CREATE]: SettingService.handleCreateSetting.bind(this),
          [ServerAction.BILLING_SYNCHRONIZE_USERS]: BillingService.handleSynchronizeUsers.bind(this),
          [ServerAction.BILLING_SYNCHRONIZE_USER]: BillingService.handleSynchronizeUser.bind(this),
          [ServerAction.BILLING_FORCE_SYNCHRONIZE_USER]: BillingService.handleForceSynchronizeUser.bind(this),
          [ServerAction.BILLING_SYNCHRONIZE_INVOICES]: BillingService.handleSynchronizeInvoices.bind(this),
          [ServerAction.BILLING_FORCE_SYNCHRONIZE_USER_INVOICES]: BillingService.handleForceSynchronizeUserInvoices.bind(this),
          [ServerAction.BILLING_SETUP_PAYMENT_METHOD]: BillingService.handleBillingSetupPaymentMethod.bind(this),
          [ServerAction.OCPI_ENDPOINT_CREATE]: OCPIEndpointService.handleCreateOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_PING]: OCPIEndpointService.handlePingOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_CHECK_CDRS]: OCPIEndpointService.handleCheckCdrsEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_CHECK_LOCATIONS]: OCPIEndpointService.handleCheckLocationsEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_CHECK_SESSIONS]: OCPIEndpointService.handleCheckSessionsEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_PULL_CDRS]: OCPIEndpointService.handlePullCdrsEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_PULL_LOCATIONS]: OCPIEndpointService.handlePullLocationsEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_PULL_SESSIONS]: OCPIEndpointService.handlePullSessionsEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_PULL_TOKENS]: OCPIEndpointService.handlePullTokensEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_SEND_EVSE_STATUSES]: OCPIEndpointService.handlePushEVSEStatusesOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_SEND_TOKENS]: OCPIEndpointService.handlePushTokensOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_GENERATE_LOCAL_TOKEN]: OCPIEndpointService.handleGenerateLocalTokenOcpiEndpoint.bind(this),
          [ServerAction.OICP_ENDPOINT_CREATE]: OICPEndpointService.handleCreateOicpEndpoint.bind(this),
          [ServerAction.OICP_ENDPOINT_PING]: OICPEndpointService.handlePingOicpEndpoint.bind(this),
          [ServerAction.OICP_ENDPOINT_SEND_EVSE_STATUSES]: OICPEndpointService.handleSendEVSEStatusesOicpEndpoint.bind(this),
          [ServerAction.OICP_ENDPOINT_SEND_EVSES]: OICPEndpointService.handleSendEVSEsOicpEndpoint.bind(this),
          [ServerAction.INTEGRATION_CONNECTION_CREATE]: ConnectionService.handleCreateConnection.bind(this),
          [ServerAction.CHARGING_STATION_REQUEST_OCPP_PARAMETERS]: ChargingStationService.handleRequestChargingStationOcppParameters.bind(this),
          [ServerAction.CAR_CREATE]: CarService.handleCreateCar.bind(this),
          [ServerAction.TAG_CREATE]: TagService.handleCreateTag.bind(this),
          [ServerAction.END_USER_REPORT_ERROR]: NotificationService.handleEndUserReportError.bind(this),
          [ServerAction.TAGS_IMPORT]: TagService.handleImportTags.bind(this),
        });
        break;

      // Read
      case 'GET':
        // Register REST actions
        this.registerJsonActionsPaths({
          [ServerAction.LOGGINGS]: LoggingService.handleGetLogs.bind(this),
          [ServerAction.LOGGING]: LoggingService.handleGetLog.bind(this),
          [ServerAction.LOGGINGS_EXPORT]: LoggingService.handleExportLogs.bind(this),
          [ServerAction.CHARGING_STATIONS]: ChargingStationService.handleGetChargingStations.bind(this),
          [ServerAction.CAR_CATALOGS]: CarService.handleGetCarCatalogs.bind(this),
          [ServerAction.CAR_CATALOG]: CarService.handleGetCarCatalog.bind(this),
          [ServerAction.CAR_MAKERS]: CarService.handleGetCarMakers.bind(this),
          [ServerAction.CARS]: CarService.handleGetCars.bind(this),
          [ServerAction.CAR]: CarService.handleGetCar.bind(this),
          [ServerAction.CAR_CATALOG_IMAGES]: CarService.handleGetCarCatalogImages.bind(this),
          [ServerAction.REGISTRATION_TOKENS]: RegistrationTokenService.handleGetRegistrationTokens.bind(this),
          [ServerAction.REGISTRATION_TOKEN]: RegistrationTokenService.handleGetRegistrationToken.bind(this),
          [ServerAction.COMPANIES]: CompanyService.handleGetCompanies.bind(this),
          [ServerAction.COMPANY]: CompanyService.handleGetCompany.bind(this),
          [ServerAction.ASSETS]: AssetService.handleGetAssets.bind(this),
          [ServerAction.ASSET]: AssetService.handleGetAsset.bind(this),
          [ServerAction.ASSET_IMAGE]: AssetService.handleGetAssetImage.bind(this),
          [ServerAction.ASSETS_IN_ERROR]: AssetService.handleGetAssetsInError.bind(this),
          [ServerAction.CHECK_ASSET_CONNECTION]: AssetService.handleCheckAssetConnection.bind(this),
          [ServerAction.RETRIEVE_ASSET_CONSUMPTION]: AssetService.handleRetrieveConsumption.bind(this),
          [ServerAction.ASSET_CONSUMPTION]: AssetService.handleGetAssetConsumption.bind(this),
          [ServerAction.SITES]: SiteService.handleGetSites.bind(this),
          [ServerAction.SITE]: SiteService.handleGetSite.bind(this),
          [ServerAction.SITE_USERS]: SiteService.handleGetUsers.bind(this),
          [ServerAction.TENANTS]: TenantService.handleGetTenants.bind(this),
          [ServerAction.TENANT]: TenantService.handleGetTenant.bind(this),
          [ServerAction.SITE_AREAS]: SiteAreaService.handleGetSiteAreas.bind(this),
          [ServerAction.SITE_AREA]: SiteAreaService.handleGetSiteArea.bind(this),
          [ServerAction.SITE_AREA_CONSUMPTION]: SiteAreaService.handleGetSiteAreaConsumption.bind(this),
          [ServerAction.USERS]: UserService.handleGetUsers.bind(this),
          [ServerAction.NOTIFICATIONS]: NotificationService.handleGetNotifications.bind(this),
          [ServerAction.TAGS]: TagService.handleGetTags.bind(this),
          [ServerAction.TAG]: TagService.handleGetTag.bind(this),
          [ServerAction.TAG_BY_VISUAL_ID]: TagService.handleGetTagByVisualID.bind(this),
          [ServerAction.TAGS_EXPORT]: TagService.handleExportTags.bind(this),
          [ServerAction.TRANSACTIONS_COMPLETED]: TransactionService.handleGetTransactionsCompleted.bind(this),
          [ServerAction.TRANSACTIONS_TO_REFUND]: TransactionService.handleGetTransactionsToRefund.bind(this),
          [ServerAction.TRANSACTIONS_TO_REFUND_EXPORT]: TransactionService.handleExportTransactionsToRefund.bind(this),
          [ServerAction.TRANSACTIONS_TO_REFUND_REPORTS]: TransactionService.handleGetRefundReports.bind(this),
          [ServerAction.TRANSACTIONS_EXPORT]: TransactionService.handleExportTransactions.bind(this),
          [ServerAction.TRANSACTIONS_ACTIVE]: TransactionService.handleGetTransactionsActive.bind(this),
          [ServerAction.TRANSACTIONS_IN_ERROR]: TransactionService.handleGetTransactionsInError.bind(this),
          [ServerAction.TRANSACTION_YEARS]: TransactionService.handleGetTransactionYears.bind(this),
          [ServerAction.TRANSACTION_OCPI_CDR_EXPORT]: TransactionService.handleExportTransactionOcpiCdr.bind(this),
          [ServerAction.CHARGING_STATION_CONSUMPTION_STATISTICS]: StatisticService.handleGetChargingStationConsumptionStatistics.bind(this),
          [ServerAction.CHARGING_STATION_USAGE_STATISTICS]: StatisticService.handleGetChargingStationUsageStatistics.bind(this),
          [ServerAction.CHARGING_STATION_INACTIVITY_STATISTICS]: StatisticService.handleGetChargingStationInactivityStatistics.bind(this),
          [ServerAction.CHARGING_STATION_TRANSACTIONS_STATISTICS]: StatisticService.handleGetChargingStationTransactionsStatistics.bind(this),
          [ServerAction.CHARGING_STATION_PRICING_STATISTICS]: StatisticService.handleGetChargingStationPricingStatistics.bind(this),
          [ServerAction.STATISTICS_EXPORT]: StatisticService.handleExportStatistics.bind(this),
          [ServerAction.USER_CONSUMPTION_STATISTICS]: StatisticService.handleGetUserConsumptionStatistics.bind(this),
          [ServerAction.USER_USAGE_STATISTICS]: StatisticService.handleGetUserUsageStatistics.bind(this),
          [ServerAction.USER_INACTIVITY_STATISTICS]: StatisticService.handleGetUserInactivityStatistics.bind(this),
          [ServerAction.USER_TRANSACTIONS_STATISTICS]: StatisticService.handleGetUserTransactionsStatistics.bind(this),
          [ServerAction.USER_PRICING_STATISTICS]: StatisticService.handleGetUserPricingStatistics.bind(this),
          [ServerAction.CHARGING_STATION_TRANSACTIONS]: TransactionService.handleGetChargingStationTransactions.bind(this),
          [ServerAction.TRANSACTION]: TransactionService.handleGetTransaction.bind(this),
          [ServerAction.TRANSACTION_CONSUMPTION]: TransactionService.handleGetTransactionConsumption.bind(this),
          [ServerAction.SETTING_BY_IDENTIFIER]: SettingService.handleGetSettingByIdentifier.bind(this),
          [ServerAction.SETTINGS]: SettingService.handleGetSettings.bind(this),
          [ServerAction.SETTING]: SettingService.handleGetSetting.bind(this),
          [ServerAction.CHECK_BILLING_CONNECTION]: BillingService.handleCheckBillingConnection.bind(this),
          [ServerAction.BILLING_TAXES]: BillingService.handleGetBillingTaxes.bind(this),
          [ServerAction.BILLING_INVOICES]: BillingService.handleGetInvoices.bind(this),
          [ServerAction.BILLING_DOWNLOAD_INVOICE]: BillingService.handleDownloadInvoice.bind(this),
          [ServerAction.BILLING_PAYMENT_METHODS]: BillingService.handleBillingGetPaymentMethods.bind(this),
          [ServerAction.OCPI_ENDPOINTS]: OCPIEndpointService.handleGetOcpiEndpoints.bind(this),
          [ServerAction.OCPI_ENDPOINT]: OCPIEndpointService.handleGetOcpiEndpoint.bind(this),
          [ServerAction.OICP_ENDPOINTS]: OICPEndpointService.handleGetOicpEndpoints.bind(this),
          [ServerAction.OICP_ENDPOINT]: OICPEndpointService.handleGetOicpEndpoint.bind(this),
          [ServerAction.INTEGRATION_CONNECTIONS]: ConnectionService.handleGetConnections.bind(this),
          [ServerAction.INTEGRATION_CONNECTION]: ConnectionService.handleGetConnection.bind(this),
          [ServerAction.PING]: (action: ServerAction, req: Request, res: Response, next: NextFunction) => {
            res.sendStatus(StatusCodes.OK);
          },
        });
        break;

      // Update
      case 'PUT':
        // Register REST actions
        this.registerJsonActionsPaths({
          [ServerAction.TENANT_UPDATE]: TenantService.handleUpdateTenant.bind(this),
          [ServerAction.SITE_UPDATE]: SiteService.handleUpdateSite.bind(this),
          [ServerAction.SITE_AREA_UPDATE]: SiteAreaService.handleUpdateSiteArea.bind(this),
          [ServerAction.COMPANY_UPDATE]: CompanyService.handleUpdateCompany.bind(this),
          [ServerAction.ASSET_UPDATE]: AssetService.handleUpdateAsset.bind(this),
          [ServerAction.SITE_USER_ADMIN]: SiteService.handleUpdateSiteUserAdmin.bind(this),
          [ServerAction.SITE_OWNER]: SiteService.handleUpdateSiteOwner.bind(this),
          [ServerAction.TRANSACTION_SOFT_STOP]: TransactionService.handleTransactionSoftStop.bind(this),
          [ServerAction.SETTING_UPDATE]: SettingService.handleUpdateSetting.bind(this),
          [ServerAction.OCPI_ENDPOINT_UPDATE]: OCPIEndpointService.handleUpdateOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_REGISTER]: OCPIEndpointService.handleRegisterOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_UNREGISTER]: OCPIEndpointService.handleUnregisterOcpiEndpoint.bind(this),
          [ServerAction.OICP_ENDPOINT_UPDATE]: OICPEndpointService.handleUpdateOicpEndpoint.bind(this),
          [ServerAction.OICP_ENDPOINT_REGISTER]: OICPEndpointService.handleRegisterOicpEndpoint.bind(this),
          [ServerAction.OICP_ENDPOINT_UNREGISTER]: OICPEndpointService.handleUnregisterOicpEndpoint.bind(this),
          [ServerAction.SYNCHRONIZE_CAR_CATALOGS]: CarService.handleSynchronizeCarCatalogs.bind(this),
          [ServerAction.CAR_UPDATE]: CarService.handleUpdateCar.bind(this),
          [ServerAction.TAG_UPDATE]: TagService.handleUpdateTag.bind(this),
          [ServerAction.TAG_UPDATE_BY_VISUAL_ID]: TagService.handleUpdateTagByVisualID.bind(this),
          [ServerAction.TAGS_UNASSIGN]: TagService.handleUnassignTags.bind(this),
          [ServerAction.TAG_UNASSIGN]: TagService.handleUnassignTag.bind(this),
          [ServerAction.TAG_ASSIGN]: TagService.handleAssignTag.bind(this),
          [ServerAction.REGISTRATION_TOKEN_UPDATE]: RegistrationTokenService.handleUpdateRegistrationToken.bind(this),
        });
        break;

      // Delete
      case 'DELETE':
        // Register REST actions
        this.registerJsonActionsPaths({
          [ServerAction.TENANT_DELETE]: TenantService.handleDeleteTenant.bind(this),
          [ServerAction.REGISTRATION_TOKEN_DELETE]: RegistrationTokenService.handleDeleteRegistrationToken.bind(this),
          [ServerAction.REGISTRATION_TOKEN_REVOKE]: RegistrationTokenService.handleRevokeRegistrationToken.bind(this),
          [ServerAction.SITE_DELETE]: SiteService.handleDeleteSite.bind(this),
          [ServerAction.SITE_AREA_DELETE]: SiteAreaService.handleDeleteSiteArea.bind(this),
          [ServerAction.COMPANY_DELETE]: CompanyService.handleDeleteCompany.bind(this),
          [ServerAction.ASSET_DELETE]: AssetService.handleDeleteAsset.bind(this),
          [ServerAction.TRANSACTION_DELETE]: TransactionService.handleDeleteTransaction.bind(this),
          [ServerAction.TRANSACTIONS_DELETE]: TransactionService.handleDeleteTransactions.bind(this),
          [ServerAction.INTEGRATION_CONNECTION_DELETE]: ConnectionService.handleDeleteConnection.bind(this),
          [ServerAction.SETTING_DELETE]: SettingService.handleDeleteSetting.bind(this),
          [ServerAction.OCPI_ENDPOINT_DELETE]: OCPIEndpointService.handleDeleteOcpiEndpoint.bind(this),
          [ServerAction.OICP_ENDPOINT_DELETE]: OICPEndpointService.handleDeleteOicpEndpoint.bind(this),
          [ServerAction.CAR_DELETE]: CarService.handleDeleteCar.bind(this),
          [ServerAction.TAG_DELETE]: TagService.handleDeleteTag.bind(this),
          [ServerAction.TAGS_DELETE]: TagService.handleDeleteTags.bind(this),
          [ServerAction.BILLING_DELETE_PAYMENT_METHOD]: BillingService.handleBillingDeletePaymentMethod.bind(this),
        });
        break;
    }
  }

  public static getInstanceFromHTTPVerb(method: string): RequestMapper {
    if (!RequestMapper.instances.has(method)) {
      RequestMapper.instances.set(method, new RequestMapper(method));
    }
    return RequestMapper.instances.get(method);
  }

  public registerOneActionManyPaths(action: (action: ServerAction, req: Request, res: Response, next: NextFunction) => void|Promise<void>, ...paths: ServerAction[]) {
    const index = this.actions.push(action) - 1;
    for (const path of paths) {
      this.paths.set(path, index);
    }
  }

  public registerJsonActionsPaths(dict: { [key in ServerAction]?: (action: ServerAction, req: Request, res: Response, next: NextFunction) => void|Promise<void>; }) {
    for (const key in dict) {
      this.registerOneActionManyPaths(dict[key], key as ServerAction);
    }
  }

  public getActionFromPath(path: string): (action: ServerAction, req: Request, res: Response, next: NextFunction) => void|Promise<void> {
    if (!this.paths.has(path)) {
      return UtilsService.handleUnknownAction.bind(this);
    }
    return this.actions[this.paths.get(path)];
  }
}

export default class CentralRestServerService {
  // Util Service
  public static async restServiceUtil(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Parse the action
      const action = req.params.action as ServerAction;
      // Check Context
      switch (req.method) {
        // Create Request
        case 'GET':
          // Check Context
          switch (action) {
            // Ping
            case ServerAction.PING:
              res.sendStatus(StatusCodes.OK);
              break;
            case ServerAction.CAR_CATALOG_IMAGE:
              await CarService.handleGetCarCatalogImage(action, req, res, next);
              break;
            case ServerAction.ASSET_IMAGE:
              await AssetService.handleGetAssetImage(action, req, res, next);
              break;
            case ServerAction.COMPANY_LOGO:
              await CompanyService.handleGetCompanyLogo(action, req, res, next);
              break;
            case ServerAction.SITE_IMAGE:
              await SiteService.handleGetSiteImage(action, req, res, next);
              break;
            case ServerAction.SITE_AREA_IMAGE:
              await SiteAreaService.handleGetSiteAreaImage(action, req, res, next);
              break;
            case ServerAction.TENANT_LOGO:
              await TenantService.handleGetTenantLogo(action, req, res, next);
              break;
            default:
              // Delegate
              await UtilsService.handleUnknownAction(action, req, res, next);
          }
          break;

        case 'POST':
          // Check Context
          switch (action) {
            // Ping
            case ServerAction.BILLING_WEB_HOOK:
              await BillingService.handleBillingWebHook(action, req, res, next);
              // Res.sendStatus(StatusCodes.OK);
              break;
            default:
              // Delegate
              await UtilsService.handleUnknownAction(action, req, res, next);
          }
          break;
      }
    } catch (error) {
      next(error);
    }
  }

  public static async restServiceSecured(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Parse the action
    const action = req.params.action as ServerAction;
    // Check HTTP Verbs
    if (!['POST', 'GET', 'PUT', 'DELETE'].includes(req.method)) {
      await Logging.logActionExceptionMessageAndSendResponse(
        null, new Error(`Unsupported request method ${req.method}`), req, res, next);
      return;
    }
    try {
      // Get the action
      const handleRequest = RequestMapper.getInstanceFromHTTPVerb(req.method).getActionFromPath(action);
      // Execute
      await handleRequest(action, req, res, next);
    } catch (error) {
      next(error);
    }
  }
}
