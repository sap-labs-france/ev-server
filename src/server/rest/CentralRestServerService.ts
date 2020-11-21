import { NextFunction, Request, Response } from 'express';

import AssetService from './v1/service/AssetService';
import BillingService from './v1/service/BillingService';
import CarService from './v1/service/CarService';
import ChargingStationService from './v1/service/ChargingStationService';
import { Command } from '../../types/ChargingStation';
import CompanyService from './v1/service/CompanyService';
import ConnectionService from './v1/service/ConnectionService';
import Logging from '../../utils/Logging';
import LoggingService from './v1/service/LoggingService';
import NotificationService from './v1/service/NotificationService';
import OCPIEndpointService from './v1/service/OCPIEndpointService';
import RegistrationTokenService from './v1/service/RegistrationTokenService';
import { ServerAction } from '../../types/Server';
import SessionHashService from './v1/service/SessionHashService';
import SettingService from './v1/service/SettingService';
import SiteAreaService from './v1/service/SiteAreaService';
import SiteService from './v1/service/SiteService';
import StatisticService from './v1/service/StatisticService';
import { StatusCodes } from 'http-status-codes';
import TenantService from './v1/service/TenantService';
import TransactionService from './v1/service/TransactionService';
import UserService from './v1/service/UserService';
import UtilsService from './v1/service/UtilsService';

class RequestMapper {
  // eslint-disable-next-line no-undef
  private static instances = new Map<string, RequestMapper>();
  // eslint-disable-next-line no-undef
  private paths = new Map<string, number>();
  private actions = new Array<(action: ServerAction, req: Request, res: Response, next: NextFunction) => void|Promise<void>>();

  private constructor(httpVerb: string) {
    switch (httpVerb) {
      // Create
      case 'POST':
        this.registerOneActionManyPaths(
          async (action: ServerAction, req: Request, res: Response, next: NextFunction) => {
            // Keep the action (remove ChargingStation)
            const command = action.slice(15) as Command;
            // Delegate
            await ChargingStationService.handleAction(action, command, req, res, next);
          },
          ServerAction.CHARGING_STATION_CLEAR_CACHE,
          ServerAction.CHARGING_STATION_GET_CONFIGURATION,
          ServerAction.CHARGING_STATION_CHANGE_CONFIGURATION,
          ServerAction.CHARGING_STATION_REMOTE_STOP_TRANSACTION,
          ServerAction.CHARGING_STATION_REMOTE_START_TRANSACTION,
          ServerAction.CHARGING_STATION_UNLOCK_CONNECTOR,
          ServerAction.CHARGING_STATION_RESET,
          ServerAction.CHARGING_STATION_SET_CHARGING_PROFILE,
          ServerAction.CHARGING_STATION_GET_COMPOSITE_SCHEDULE,
          ServerAction.CHARGING_STATION_CLEAR_CHARGING_PROFILE,
          ServerAction.CHARGING_STATION_GET_DIAGNOSTICS,
          ServerAction.CHARGING_STATION_CHANGE_AVAILABILITY,
          ServerAction.CHARGING_STATION_UPDATE_FIRMWARE
        );
        // Register REST actions
        this.registerJsonActionsPaths({
          [ServerAction.ADD_CHARGING_STATIONS_TO_SITE_AREA]: SiteAreaService.handleAssignChargingStationsToSiteArea.bind(this),
          [ServerAction.REMOVE_CHARGING_STATIONS_FROM_SITE_AREA]: SiteAreaService.handleAssignChargingStationsToSiteArea.bind(this),
          [ServerAction.REGISTRATION_TOKEN_CREATE]: RegistrationTokenService.handleCreateRegistrationToken.bind(this),
          [ServerAction.USER_CREATE]: UserService.handleCreateUser.bind(this),
          [ServerAction.COMPANY_CREATE]: CompanyService.handleCreateCompany.bind(this),
          [ServerAction.ADD_ASSET_TO_SITE_AREA]: SiteAreaService.handleAssignAssetsToSiteArea.bind(this),
          [ServerAction.REMOVE_ASSET_TO_SITE_AREA]: SiteAreaService.handleAssignAssetsToSiteArea.bind(this),
          [ServerAction.ASSET_CREATE]: AssetService.handleCreateAsset.bind(this),
          [ServerAction.TENANT_CREATE]: TenantService.handleCreateTenant.bind(this),
          [ServerAction.SITE_CREATE]: SiteService.handleCreateSite.bind(this),
          [ServerAction.ADD_USERS_TO_SITE]: SiteService.handleAssignUsersToSite.bind(this),
          [ServerAction.REMOVE_USERS_FROM_SITE]: SiteService.handleAssignUsersToSite.bind(this),
          [ServerAction.ADD_SITES_TO_USER]: UserService.handleAssignSitesToUser.bind(this),
          [ServerAction.REMOVE_SITES_FROM_USER]: UserService.handleAssignSitesToUser.bind(this),
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
          [ServerAction.BILLING_CREATE_TRANSACTION_INVOICE]: BillingService.handleCreateTransactionInvoice.bind(this),
          [ServerAction.OCPI_ENPOINT_CREATE]: OCPIEndpointService.handleCreateOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENPOINT_PING]: OCPIEndpointService.handlePingOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENPOINT_CHECK_CDRS]: OCPIEndpointService.handleCheckCdrsEndpoint.bind(this),
          [ServerAction.OCPI_ENPOINT_CHECK_LOCATIONS]: OCPIEndpointService.handleCheckLocationsEndpoint.bind(this),
          [ServerAction.OCPI_ENPOINT_CHECK_SESSIONS]: OCPIEndpointService.handleCheckSessionsEndpoint.bind(this),
          [ServerAction.OCPI_ENPOINT_PULL_CDRS]: OCPIEndpointService.handlePullCdrsEndpoint.bind(this),
          [ServerAction.OCPI_ENPOINT_PULL_LOCATIONS]: OCPIEndpointService.handlePullLocationsEndpoint.bind(this),
          [ServerAction.OCPI_ENPOINT_PULL_SESSIONS]: OCPIEndpointService.handlePullSessionsEndpoint.bind(this),
          [ServerAction.OCPI_ENPOINT_PULL_TOKENS]: OCPIEndpointService.handlePullTokensEndpoint.bind(this),
          [ServerAction.OCPI_ENPOINT_SEND_EVSE_STATUSES]: OCPIEndpointService.handleSendEVSEStatusesOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENPOINT_SEND_TOKENS]: OCPIEndpointService.handleSendTokensOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENPOINT_GENERATE_LOCAL_TOKEN]: OCPIEndpointService.handleGenerateLocalTokenOcpiEndpoint.bind(this),
          [ServerAction.INTEGRATION_CONNECTION_CREATE]: ConnectionService.handleCreateConnection.bind(this),
          [ServerAction.CHARGING_STATION_REQUEST_OCPP_PARAMETERS]: ChargingStationService.handleRequestChargingStationOcppParameters.bind(this),
          [ServerAction.CAR_CREATE]: CarService.handleCreateCar.bind(this),
          [ServerAction.TAG_CREATE]: UserService.handleCreateTag.bind(this),
          [ServerAction.END_USER_REPORT_ERROR]: NotificationService.handleEndUserReportError.bind(this),
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
          [ServerAction.CAR_USERS]: CarService.handleGetCarUsers.bind(this),
          [ServerAction.CAR_CATALOG_IMAGES]: CarService.handleGetCarCatalogImages.bind(this),
          [ServerAction.CHARGING_STATIONS_EXPORT]: ChargingStationService.handleExportChargingStations.bind(this),
          [ServerAction.CHARGING_STATIONS_OCPP_PARAMS_EXPORT]: ChargingStationService.handleExportChargingStationsOCPPParams.bind(this),
          [ServerAction.CHARGING_STATION]: ChargingStationService.handleGetChargingStation.bind(this),
          [ServerAction.CHECK_SMART_CHARGING_CONNECTION]: ChargingStationService.handleCheckSmartChargingConnection.bind(this),
          [ServerAction.CHARGING_PROFILES]: ChargingStationService.handleGetChargingProfiles.bind(this),
          [ServerAction.TRIGGER_SMART_CHARGING]: ChargingStationService.handleTriggerSmartCharging.bind(this),
          [ServerAction.REGISTRATION_TOKENS]: RegistrationTokenService.handleGetRegistrationTokens.bind(this),
          [ServerAction.STATUS_NOTIFICATIONS]: ChargingStationService.handleGetStatusNotifications.bind(this),
          [ServerAction.BOOT_NOTIFICATION]: ChargingStationService.handleGetBootNotifications.bind(this),
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
          [ServerAction.USER_SITES]: UserService.handleGetSites.bind(this),
          [ServerAction.USERS_IN_ERROR]: UserService.handleGetUsersInError.bind(this),
          [ServerAction.USER_IMAGE]: UserService.handleGetUserImage.bind(this),
          [ServerAction.USER]: UserService.handleGetUser.bind(this),
          [ServerAction.USERS_EXPORT]: UserService.handleExportUsers.bind(this),
          [ServerAction.NOTIFICATIONS]: NotificationService.handleGetNotifications.bind(this),
          [ServerAction.TAGS]: UserService.handleGetTags.bind(this),
          [ServerAction.TAG]: UserService.handleGetTag.bind(this),
          [ServerAction.TRANSACTIONS_COMPLETED]: TransactionService.handleGetTransactionsCompleted.bind(this),
          [ServerAction.TRANSACTIONS_TO_REFUND]: TransactionService.handleGetTransactionsToRefund.bind(this),
          [ServerAction.TRANSACTIONS_TO_REFUND_EXPORT]: TransactionService.handleExportTransactionsToRefund.bind(this),
          [ServerAction.TRANSACTIONS_TO_REFUND_REPORTS]: TransactionService.handleGetRefundReports.bind(this),
          [ServerAction.TRANSACTIONS_EXPORT]: TransactionService.handleExportTransactions.bind(this),
          [ServerAction.TRANSACTIONS_ACTIVE]: TransactionService.handleGetTransactionsActive.bind(this),
          [ServerAction.TRANSACTIONS_IN_ERROR]: TransactionService.handleGetTransactionsInError.bind(this),
          [ServerAction.TRANSACTION_YEARS]: TransactionService.handleGetTransactionYears.bind(this),
          [ServerAction.REBUILD_TRANSACTION_CONSUMPTIONS]: TransactionService.handleRebuildTransactionConsumptions.bind(this),
          [ServerAction.UNASSIGNED_TRANSACTIONS_COUNT]: TransactionService.handleGetUnassignedTransactionsCount.bind(this),
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
          [ServerAction.CHARGING_STATIONS_OCPP_PARAMETERS]: ChargingStationService.handleGetChargingStationOcppParameters.bind(this),
          [ServerAction.CHARGING_STATIONS_IN_ERROR]: ChargingStationService.handleGetChargingStationsInError.bind(this),
          [ServerAction.SETTINGS]: SettingService.handleGetSettings.bind(this),
          [ServerAction.SETTING]: SettingService.handleGetSetting.bind(this),
          [ServerAction.CHECK_BILLING_CONNECTION]: BillingService.handleCheckBillingConnection.bind(this),
          [ServerAction.BILLING_TAXES]: BillingService.handleGetBillingTaxes.bind(this),
          [ServerAction.BILLING_INVOICES]: BillingService.handleGetInvoices.bind(this),
          [ServerAction.BILLING_DOWNLOAD_INVOICE]: BillingService.handleDownloadInvoice.bind(this),
          [ServerAction.OCPI_ENDPOINTS]: OCPIEndpointService.handleGetOcpiEndpoints.bind(this),
          [ServerAction.OCPI_ENDPOINT]: OCPIEndpointService.handleGetOcpiEndpoint.bind(this),
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
          [ServerAction.USER_UPDATE]: UserService.handleUpdateUser.bind(this),
          [ServerAction.USER_UPDATE_MOBILE_TOKEN]: UserService.handleUpdateUserMobileToken.bind(this),
          [ServerAction.CHARGING_STATION_UPDATE_PARAMS]: ChargingStationService.handleUpdateChargingStationParams.bind(this),
          [ServerAction.CHARGING_STATION_LIMIT_POWER]: ChargingStationService.handleChargingStationLimitPower.bind(this),
          [ServerAction.CHARGING_PROFILE_UPDATE]: ChargingStationService.handleUpdateChargingProfile.bind(this),
          [ServerAction.TENANT_UPDATE]: TenantService.handleUpdateTenant.bind(this),
          [ServerAction.SITE_UPDATE]: SiteService.handleUpdateSite.bind(this),
          [ServerAction.SITE_AREA_UPDATE]: SiteAreaService.handleUpdateSiteArea.bind(this),
          [ServerAction.COMPANY_UPDATE]: CompanyService.handleUpdateCompany.bind(this),
          [ServerAction.ASSET_UPDATE]: AssetService.handleUpdateAsset.bind(this),
          [ServerAction.SITE_USER_ADMIN]: SiteService.handleUpdateSiteUserAdmin.bind(this),
          [ServerAction.SITE_OWNER]: SiteService.handleUpdateSiteOwner.bind(this),
          [ServerAction.TRANSACTION_SOFT_STOP]: TransactionService.handleTransactionSoftStop.bind(this),
          [ServerAction.ASSIGN_TRANSACTIONS_TO_USER]: TransactionService.handleAssignTransactionsToUser.bind(this),
          [ServerAction.SETTING_UPDATE]: SettingService.handleUpdateSetting.bind(this),
          [ServerAction.OCPI_ENDPOINT_UPDATE]: OCPIEndpointService.handleUpdateOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_REGISTER]: OCPIEndpointService.handleRegisterOcpiEndpoint.bind(this),
          [ServerAction.OCPI_ENDPOINT_UNREGISTER]: OCPIEndpointService.handleUnregisterOcpiEndpoint.bind(this),
          [ServerAction.SYNCHRONIZE_CAR_CATALOGS]: CarService.handleSynchronizeCarCatalogs.bind(this),
          [ServerAction.CAR_UPDATE]: CarService.handleUpdateCar.bind(this),
          [ServerAction.TAG_UPDATE]: UserService.handleUpdateTag.bind(this),
        });
        break;

      // Delete
      case 'DELETE':
        // Register REST actions
        this.registerJsonActionsPaths({
          [ServerAction.USER_DELETE]: UserService.handleDeleteUser.bind(this),
          [ServerAction.TENANT_DELETE]: TenantService.handleDeleteTenant.bind(this),
          [ServerAction.REGISTRATION_TOKEN_DELETE]: RegistrationTokenService.handleDeleteRegistrationToken.bind(this),
          [ServerAction.REGISTRATION_TOKEN_REVOKE]: RegistrationTokenService.handleRevokeRegistrationToken.bind(this),
          [ServerAction.SITE_DELETE]: SiteService.handleDeleteSite.bind(this),
          [ServerAction.SITE_AREA_DELETE]: SiteAreaService.handleDeleteSiteArea.bind(this),
          [ServerAction.COMPANY_DELETE]: CompanyService.handleDeleteCompany.bind(this),
          [ServerAction.ASSET_DELETE]: AssetService.handleDeleteAsset.bind(this),
          [ServerAction.CHARGING_STATION_DELETE]: ChargingStationService.handleDeleteChargingStation.bind(this),
          [ServerAction.CHARGING_PROFILE_DELETE]: ChargingStationService.handleDeleteChargingProfile.bind(this),
          [ServerAction.TRANSACTION_DELETE]: TransactionService.handleDeleteTransaction.bind(this),
          [ServerAction.TRANSACTIONS_DELETE]: TransactionService.handleDeleteTransactions.bind(this),
          [ServerAction.INTEGRATION_CONNECTION_DELETE]: ConnectionService.handleDeleteConnection.bind(this),
          [ServerAction.SETTING_DELETE]: SettingService.handleDeleteSetting.bind(this),
          [ServerAction.OCPI_ENDPOINT_DELETE]: OCPIEndpointService.handleDeleteOcpiEndpoint.bind(this),
          [ServerAction.CAR_DELETE]: CarService.handleDeleteCar.bind(this),
          [ServerAction.TAG_DELETE]: UserService.handleDeleteTag.bind(this),
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
            // Firmware Download
            case ServerAction.FIRMWARE_DOWNLOAD:
              await ChargingStationService.handleGetFirmware(action, req, res, next);
              break;
            default:
              // Delegate
              UtilsService.handleUnknownAction(action, req, res, next);
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
    // Check if User has been updated and require new login
    if ((await SessionHashService.isSessionHashUpdated(req, res, next))) {
      return;
    }
    // Check HTTP Verbs
    if (!['POST', 'GET', 'PUT', 'DELETE'].includes(req.method)) {
      Logging.logActionExceptionMessageAndSendResponse(
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
