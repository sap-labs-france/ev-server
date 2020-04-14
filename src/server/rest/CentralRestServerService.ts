import { NextFunction, Request, Response } from 'express';
import { Action } from '../../types/Authorization';
import Logging from '../../utils/Logging';
import BillingService from './service/BillingService';
import AssetService from './service/AssetService';
import CarService from './service/CarService';
import ChargingStationService from './service/ChargingStationService';
import CompanyService from './service/CompanyService';
import ConnectionService from './service/ConnectionService';
import LoggingService from './service/LoggingService';
import NotificationService from './service/NotificationService';
import OCPIEndpointService from './service/OCPIEndpointService';
import RegistrationTokenService from './service/RegistrationTokenService';
import SessionHashService from './service/SessionHashService';
import SettingService from './service/SettingService';
import SiteAreaService from './service/SiteAreaService';
import SiteService from './service/SiteService';
import StatisticService from './service/StatisticService';
import TenantService from './service/TenantService';
import TransactionService from './service/TransactionService';
import UserService from './service/UserService';
import UtilsService from './service/UtilsService';

class RequestMapper {
  private static instances = new Map<string, RequestMapper>();

  private paths = new Map<string, number>();
  private actions = new Array<Function>();

  private constructor(httpVerb: string) {
    switch (httpVerb) {
      // Create
      case 'POST':
        this.registerOneActionManyPaths(
          async (action: Action, req: Request, res: Response, next: NextFunction) => {
            // Keep the action (remove ChargingStation)
            action = action.slice(15) as Action;
            // Type it
            const chargingStationCommand: Action = action;
            // Delegate
            await ChargingStationService.handleAction(chargingStationCommand, req, res, next);
          },
          'ChargingStationClearCache',
          'ChargingStationGetConfiguration',
          'ChargingStationChangeConfiguration',
          'ChargingStationStopTransaction',
          'ChargingStationRemoteStopTransaction',
          'ChargingStationStartTransaction',
          'ChargingStationRemoteStartTransaction',
          'ChargingStationUnlockConnector',
          'ChargingStationReset',
          'ChargingStationSetChargingProfile',
          'ChargingStationGetCompositeSchedule',
          'ChargingStationClearChargingProfile',
          'ChargingStationGetDiagnostics',
          'ChargingStationChangeAvailability',
          'ChargingStationUpdateFirmware'
        );
        // Register REST actions
        this.registerJsonActionsPaths({
          AddChargingStationsToSiteArea: ChargingStationService.handleAssignChargingStationsToSiteArea.bind(this),
          RemoveChargingStationsFromSiteArea: ChargingStationService.handleAssignChargingStationsToSiteArea.bind(this),
          RegistrationTokenCreate: RegistrationTokenService.handleCreateRegistrationToken.bind(this),
          UserCreate: UserService.handleCreateUser.bind(this),
          CompanyCreate: CompanyService.handleCreateCompany.bind(this),
          AddAssetsToSiteArea: AssetService.handleAssignAssetsToSiteArea.bind(this),
          RemoveAssetsFromSiteArea: AssetService.handleAssignAssetsToSiteArea.bind(this),
          AssetCreate: AssetService.handleCreateAsset.bind(this),
          TenantCreate: TenantService.handleCreateTenant.bind(this),
          SiteCreate: SiteService.handleCreateSite.bind(this),
          AddUsersToSite: SiteService.handleAddUsersToSite.bind(this),
          RemoveUsersFromSite: SiteService.handleRemoveUsersFromSite.bind(this),
          AddSitesToUser: UserService.handleAssignSitesToUser.bind(this),
          RemoveSitesFromUser: UserService.handleAssignSitesToUser.bind(this),
          SiteAreaCreate: SiteAreaService.handleCreateSiteArea.bind(this),
          TransactionsRefund: TransactionService.handleRefundTransactions.bind(this),
          SynchronizeRefundedTransactions: TransactionService.handleSynchronizeRefundedTransactions.bind(this),
          SettingCreate: SettingService.handleCreateSetting.bind(this),
          SynchronizeUsersForBilling: BillingService.handleSynchronizeUsers.bind(this),
          SynchronizeUserForBilling: BillingService.handleSynchronizeUser.bind(this),
          ForceSynchronizeUserForBilling: BillingService.handleForceSynchronizeUser.bind(this),
          OcpiEndpointCreate: OCPIEndpointService.handleCreateOcpiEndpoint.bind(this),
          OcpiEndpointPing: OCPIEndpointService.handlePingOcpiEndpoint.bind(this),
          OcpiEndpointTriggerJobs: OCPIEndpointService.handleTriggerJobsEndpoint.bind(this),
          OcpiEndpointPullCdrs: OCPIEndpointService.handlePullCdrsEndpoint.bind(this),
          OcpiEndpointPullLocations: OCPIEndpointService.handlePullLocationsEndpoint.bind(this),
          OcpiEndpointPullSessions: OCPIEndpointService.handlePullSessionsEndpoint.bind(this),
          OcpiEndpointPullTokens: OCPIEndpointService.handlePullTokensEndpoint.bind(this),
          OcpiEndpointSendEVSEStatuses: OCPIEndpointService.handleSendEVSEStatusesOcpiEndpoint.bind(this),
          OcpiEndpointSendTokens: OCPIEndpointService.handleSendTokensOcpiEndpoint.bind(this),
          OcpiEndpointGenerateLocalToken: OCPIEndpointService.handleGenerateLocalTokenOcpiEndpoint.bind(this),
          IntegrationConnectionCreate: ConnectionService.handleCreateConnection.bind(this),
          ChargingStationRequestOcppParameters: ChargingStationService.handleRequestChargingStationOcppParameters.bind(this),
          _default: UtilsService.handleUnknownAction.bind(this)
        });
        break;

      // Read
      case 'GET':
        // Register REST actions
        this.registerJsonActionsPaths({
          Loggings: LoggingService.handleGetLoggings.bind(this),
          Logging: LoggingService.handleGetLogging.bind(this),
          LoggingsExport: LoggingService.handleGetLoggingsExport.bind(this),
          ChargingStations: ChargingStationService.handleGetChargingStations.bind(this),
          Cars: CarService.handleGetCars.bind(this),
          Car: CarService.handleGetCar.bind(this),
          CarMakers: CarService.handleGetCarMakers.bind(this),
          CarImages: CarService.handleGetCarImages.bind(this),
          ChargingStationsExport: ChargingStationService.handleGetChargingStationsExport.bind(this),
          ChargingStationsOCPPParamsExport:ChargingStationService.handleChargingStationsOCPPParamsExport.bind(this),
          ChargingStation: ChargingStationService.handleGetChargingStation.bind(this),
          CheckSmartChargingConnection: ChargingStationService.handleCheckSmartChargingConnection.bind(this),
          ChargingProfiles: ChargingStationService.handleGetChargingProfiles.bind(this),
          RegistrationTokens: RegistrationTokenService.handleGetRegistrationTokens.bind(this),
          StatusNotifications: ChargingStationService.handleGetStatusNotifications.bind(this),
          BootNotifications: ChargingStationService.handleGetBootNotifications.bind(this),
          Companies: CompanyService.handleGetCompanies.bind(this),
          Company: CompanyService.handleGetCompany.bind(this),
          CompanyLogo: CompanyService.handleGetCompanyLogo.bind(this),
          Assets: AssetService.handleGetAssets.bind(this),
          Asset: AssetService.handleGetAsset.bind(this),
          AssetImage: AssetService.handleGetAssetImage.bind(this),
          Sites: SiteService.handleGetSites.bind(this),
          Site: SiteService.handleGetSite.bind(this),
          SiteImage: SiteService.handleGetSiteImage.bind(this),
          SiteUsers: SiteService.handleGetUsers.bind(this),
          Tenants: TenantService.handleGetTenants.bind(this),
          Tenant: TenantService.handleGetTenant.bind(this),
          SiteAreas: SiteAreaService.handleGetSiteAreas.bind(this),
          SiteArea: SiteAreaService.handleGetSiteArea.bind(this),
          SiteAreaImage: SiteAreaService.handleGetSiteAreaImage.bind(this),
          SiteAreaConsumption: SiteAreaService.handleGetSiteAreaConsumption.bind(this),
          Users: UserService.handleGetUsers.bind(this),
          UserSites: UserService.handleGetSites.bind(this),
          UsersInError: UserService.handleGetUsersInError.bind(this),
          UserImage: UserService.handleGetUserImage.bind(this),
          User: UserService.handleGetUser.bind(this),
          UserInvoice: UserService.handleGetUserInvoice.bind(this),
          Notifications: NotificationService.handleGetNotifications.bind(this),
          TransactionsCompleted: TransactionService.handleGetTransactionsCompleted.bind(this),
          TransactionsToRefund: TransactionService.handleGetTransactionsToRefund.bind(this),
          TransactionsToRefundExport: TransactionService.handleGetTransactionsToRefundExport.bind(this),
          TransactionsRefundReports: TransactionService.handleGetRefundReports.bind(this),
          TransactionsExport: TransactionService.handleGetTransactionsExport.bind(this),
          TransactionsActive: TransactionService.handleGetTransactionsActive.bind(this),
          TransactionsInError: TransactionService.handleGetTransactionsInError.bind(this),
          TransactionYears: TransactionService.handleGetTransactionYears.bind(this),
          UnassignedTransactionsCount: TransactionService.handleGetUnassignedTransactionsCount.bind(this),
          ChargingStationConsumptionStatistics: StatisticService.handleGetChargingStationConsumptionStatistics.bind(this),
          ChargingStationUsageStatistics: StatisticService.handleGetChargingStationUsageStatistics.bind(this),
          ChargingStationInactivityStatistics: StatisticService.handleGetChargingStationInactivityStatistics.bind(this),
          ChargingStationTransactionsStatistics: StatisticService.handleGetChargingStationTransactionsStatistics.bind(this),
          ChargingStationPricingStatistics: StatisticService.handleGetChargingStationPricingStatistics.bind(this),
          CurrentMetrics: StatisticService.handleGetCurrentMetrics.bind(this),
          StatisticsExport: StatisticService.handleGetStatisticsExport.bind(this),
          UserConsumptionStatistics: StatisticService.handleGetUserConsumptionStatistics.bind(this),
          UserUsageStatistics: StatisticService.handleGetUserUsageStatistics.bind(this),
          UserInactivityStatistics: StatisticService.handleGetUserInactivityStatistics.bind(this),
          UserTransactionsStatistics: StatisticService.handleGetUserTransactionsStatistics.bind(this),
          UserPricingStatistics: StatisticService.handleGetUserPricingStatistics.bind(this),
          ChargingStationTransactions: TransactionService.handleGetChargingStationTransactions.bind(this),
          Transaction: TransactionService.handleGetTransaction.bind(this),
          ConsumptionFromTransaction: TransactionService.handleGetConsumptionFromTransaction.bind(this),
          ChargingStationConsumptionFromTransaction: TransactionService.handleGetConsumptionFromTransaction.bind(this),
          ChargingStationOcppParameters: ChargingStationService.handleGetChargingStationOcppParameters.bind(this),
          ChargingStationsInError: ChargingStationService.handleGetChargingStationsInError.bind(this),
          IsAuthorized: ChargingStationService.handleIsAuthorized.bind(this),
          Settings: SettingService.handleGetSettings.bind(this),
          Setting: SettingService.handleGetSetting.bind(this),
          CheckBillingConnection: BillingService.handleCheckBillingConnection.bind(this),
          BillingTaxes: BillingService.handleGetBillingTaxes.bind(this),
          BillingUserInvoices: BillingService.handleGetUserInvoices.bind(this),
          OcpiEndpoints: OCPIEndpointService.handleGetOcpiEndpoints.bind(this),
          OcpiEndpoint: OCPIEndpointService.handleGetOcpiEndpoint.bind(this),
          IntegrationConnections: ConnectionService.handleGetConnections.bind(this),
          IntegrationConnection: ConnectionService.handleGetConnection.bind(this),
          _default: UtilsService.handleUnknownAction.bind(this),
          Ping: (action: Action, req: Request, res: Response, next: NextFunction) => res.sendStatus(200)
        });
        break;

      // Update
      case 'PUT':
        // Register REST actions
        this.registerJsonActionsPaths({
          UserUpdate: UserService.handleUpdateUser.bind(this),
          UpdateUserMobileToken: UserService.handleUpdateUserMobileToken.bind(this),
          ChargingStationUpdateParams: ChargingStationService.handleUpdateChargingStationParams.bind(this),
          ChargingStationLimitPower: ChargingStationService.handleChargingStationLimitPower.bind(this),
          ChargingProfileUpdate: ChargingStationService.handleUpdateChargingProfile.bind(this),
          TenantUpdate: TenantService.handleUpdateTenant.bind(this),
          SiteUpdate: SiteService.handleUpdateSite.bind(this),
          SiteAreaUpdate: SiteAreaService.handleUpdateSiteArea.bind(this),
          CompanyUpdate: CompanyService.handleUpdateCompany.bind(this),
          AssetUpdate: AssetService.handleUpdateAsset.bind(this),
          SiteUserAdmin: SiteService.handleUpdateSiteUserAdmin.bind(this),
          SiteOwner: SiteService.handleUpdateSiteOwner.bind(this),
          TransactionSoftStop: TransactionService.handleTransactionSoftStop.bind(this),
          AssignTransactionsToUser: TransactionService.handleAssignTransactionsToUser.bind(this),
          SettingUpdate: SettingService.handleUpdateSetting.bind(this),
          OcpiEndpointUpdate: OCPIEndpointService.handleUpdateOcpiEndpoint.bind(this),
          OcpiEndpointRegister: OCPIEndpointService.handleRegisterOcpiEndpoint.bind(this),
          OcpiEndpointUnregister: OCPIEndpointService.handleUnregisterOcpiEndpoint.bind(this),
          SynchronizeCars: CarService.handleSynchronizeCars.bind(this),
          _default: UtilsService.handleUnknownAction.bind(this)
        });
        break;

      // Delete
      case 'DELETE':
        // Register REST actions
        this.registerJsonActionsPaths({
          UserDelete: UserService.handleDeleteUser.bind(this),
          TenantDelete: TenantService.handleDeleteTenant.bind(this),
          RegistrationTokenDelete: RegistrationTokenService.handleDeleteRegistrationToken.bind(this),
          RegistrationTokenRevoke: RegistrationTokenService.handleRevokeRegistrationToken.bind(this),
          SiteDelete: SiteService.handleDeleteSite.bind(this),
          SiteAreaDelete: SiteAreaService.handleDeleteSiteArea.bind(this),
          CompanyDelete: CompanyService.handleDeleteCompany.bind(this),
          AssetDelete: AssetService.handleDeleteAsset.bind(this),
          ChargingStationDelete: ChargingStationService.handleDeleteChargingStation.bind(this),
          ChargingProfileDelete: ChargingStationService.handleDeleteChargingProfile.bind(this),
          TransactionDelete: TransactionService.handleDeleteTransaction.bind(this),
          TransactionsDelete: TransactionService.handleDeleteTransactions.bind(this),
          IntegrationConnectionDelete: ConnectionService.handleDeleteConnection.bind(this),
          SettingDelete: SettingService.handleDeleteSetting.bind(this),
          OcpiEndpointDelete: OCPIEndpointService.handleDeleteOcpiEndpoint.bind(this),
          _default: UtilsService.handleUnknownAction.bind(this)
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

  public registerOneActionManyPaths(action: Function, ...paths: string[]) {
    const index = this.actions.push(action) - 1;
    for (const path of paths) {
      this.paths.set(path, index);
    }
  }

  public registerJsonActionsPaths(dict: any) {
    for (const key in dict) {
      this.registerOneActionManyPaths(dict[key], key);
    }
  }

  public getActionFromPath(path: string): Function {
    if (!this.paths.has(path)) {
      path = '_default';
    }
    return this.actions[this.paths.get(path)];
  }
}

export default {
  // Util Service
  // eslint-disable-next-line no-unused-vars
  async restServiceUtil(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Parse the action
    const action = req.params.action as Action;
    // Check Context
    switch (req.method) {
      // Create Request
      case 'GET':
        // Check Context
        switch (action) {
          // Ping
          case Action.PING:
            res.sendStatus(200);
            break;
          // FirmwareDownload
          case Action.FIRMWARE_DOWNLOAD:
            try {
              await ChargingStationService.handleGetFirmware(action, req, res, next);
            } catch (error) {
              Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
            }
            break;
          default:
            // Delegate
            UtilsService.handleUnknownAction(action, req, res, next);
        }
        break;
    }
  },

  async restServiceSecured(req: Request, res: Response, next: NextFunction) {
    // Parse the action
    const action = req.params.action as Action;
    // Check if User has been updated and require new login
    if (SessionHashService.isSessionHashUpdated(req, res, next)) {
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
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
};
