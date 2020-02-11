import { NextFunction, Request, Response } from 'express';
import Logging from '../../utils/Logging';
import BillingService from './service/BillingService';
import ChargingStationService from './service/ChargingStationService';
import CompanyService from './service/CompanyService';
import ConnectorService from './service/ConnectorService';
import LoggingService from './service/LoggingService';
import NotificationService from './service/NotificationService';
import OCPIEndpointService from './service/OCPIEndpointService';
import PricingService from './service/PricingService';
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
import VehicleManufacturerService from './service/VehicleManufacturerService';
import VehicleService from './service/VehicleService';
import { OCPPChargingStationCommand } from '../../types/ocpp/OCPPClient';

class RequestMapper {
  private static instances = new Map<string, RequestMapper>();

  private paths = new Map<string, number>();
  private actions = new Array<Function>();

  private constructor(httpVerb: string) {
    switch (httpVerb) {
      // Create
      case 'POST':
        // Register Charging Stations actions
        this.registerOneActionManyPaths(
          async (action: string, req: Request, res: Response, next: NextFunction) => {
            action = action.slice(15);
            await ChargingStationService.handleActionSetMaxIntensitySocket(action, req, res, next);
          },
          'ChargingStationSetMaxIntensitySocket'
        );
        this.registerOneActionManyPaths(
          async (action: string, req: Request, res: Response, next: NextFunction) => {
            // Keep the action (remove ChargingStation)
            action = action.slice(15);
            // TODO: To Remove
            // Hack for mobile app not sending the RemoteStopTransaction yet
            if (action === 'StartTransaction') {
              action = 'RemoteStartTransaction';
            }
            if (action === 'StopTransaction') {
              action = 'RemoteStopTransaction';
            }
            // Type it
            const chargingStationCommand: OCPPChargingStationCommand = action as OCPPChargingStationCommand;
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
          TenantCreate: TenantService.handleCreateTenant.bind(this),
          VehicleCreate: VehicleService.handleCreateVehicle.bind(this),
          VehicleManufacturerCreate: VehicleManufacturerService.handleCreateVehicleManufacturer.bind(this),
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
          OcpiEndpointCreate: OCPIEndpointService.handleCreateOcpiEndpoint.bind(this),
          OcpiEndpointPing: OCPIEndpointService.handlePingOcpiEndpoint.bind(this),
          OcpiEndpointTriggerJobs: OCPIEndpointService.handleTriggerJobsEndpoint.bind(this),
          OcpiEndpointPullCdrs: OCPIEndpointService.handlePullCdrsEndpoint.bind(this),
          OcpiEndpointPullLocations: OCPIEndpointService.handlePullLocationsEndpoint.bind(this),
          OcpiEndpointPullSessions: OCPIEndpointService.handlePullSessionsEndpoint.bind(this),
          OcpiEndpointSendEVSEStatuses: OCPIEndpointService.handleSendEVSEStatusesOcpiEndpoint.bind(this),
          OcpiEndpointSendTokens: OCPIEndpointService.handleSendTokensOcpiEndpoint.bind(this),
          OcpiEndpointGenerateLocalToken: OCPIEndpointService.handleGenerateLocalTokenOcpiEndpoint.bind(this),
          IntegrationConnectionCreate: ConnectorService.handleCreateConnection.bind(this),
          ChargingStationRequestConfiguration: ChargingStationService.handleRequestChargingStationConfiguration.bind(this),
          _default: UtilsService.handleUnknownAction.bind(this)
        });
        break;

      // Read
      case 'GET':
        // Register REST actions
        this.registerJsonActionsPaths({
          Pricing: PricingService.handleGetPricing.bind(this),
          Loggings: LoggingService.handleGetLoggings.bind(this),
          Logging: LoggingService.handleGetLogging.bind(this),
          LoggingsExport: LoggingService.handleGetLoggingsExport.bind(this),
          ChargingStations: ChargingStationService.handleGetChargingStations.bind(this),
          ChargingStationsExport: ChargingStationService.handleGetChargingStationsExport.bind(this),
          ChargingStationsOCPPParamsExport:ChargingStationService.handleChargingStationsOCPPParamsExport.bind(this),
          ChargingStation: ChargingStationService.handleGetChargingStation.bind(this),
          ChargingProfile: ChargingStationService.handleGetChargingProfiles.bind(this),
          RegistrationTokens: RegistrationTokenService.handleGetRegistrationTokens.bind(this),
          StatusNotifications: ChargingStationService.handleGetStatusNotifications.bind(this),
          BootNotifications: ChargingStationService.handleGetBootNotifications.bind(this),
          Companies: CompanyService.handleGetCompanies.bind(this),
          Company: CompanyService.handleGetCompany.bind(this),
          CompanyLogo: CompanyService.handleGetCompanyLogo.bind(this),
          Sites: SiteService.handleGetSites.bind(this),
          Site: SiteService.handleGetSite.bind(this),
          SiteImage: SiteService.handleGetSiteImage.bind(this),
          SiteUsers: SiteService.handleGetUsers.bind(this),
          Tenants: TenantService.handleGetTenants.bind(this),
          Tenant: TenantService.handleGetTenant.bind(this),
          Vehicles: VehicleService.handleGetVehicles.bind(this),
          Vehicle: VehicleService.handleGetVehicle.bind(this),
          VehicleImage: VehicleService.handleGetVehicleImage.bind(this),
          VehicleManufacturers: VehicleManufacturerService.handleGetVehicleManufacturers.bind(this),
          VehicleManufacturer: VehicleManufacturerService.handleGetVehicleManufacturer.bind(this),
          VehicleManufacturerLogo: VehicleManufacturerService.handleGetVehicleManufacturerLogo.bind(this),
          SiteAreas: SiteAreaService.handleGetSiteAreas.bind(this),
          SiteArea: SiteAreaService.handleGetSiteArea.bind(this),
          SiteAreaImage: SiteAreaService.handleGetSiteAreaImage.bind(this),
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
          ChargingStationConfiguration: ChargingStationService.handleGetChargingStationConfiguration.bind(this),
          ChargingStationsInError: ChargingStationService.handleGetChargingStationsInError.bind(this),
          IsAuthorized: ChargingStationService.handleIsAuthorized.bind(this),
          Settings: SettingService.handleGetSettings.bind(this),
          Setting: SettingService.handleGetSetting.bind(this),
          BillingConnection: BillingService.handleGetBillingConnection.bind(this),
          BillingTaxes: BillingService.handleGetBillingTaxes.bind(this),
          OcpiEndpoints: OCPIEndpointService.handleGetOcpiEndpoints.bind(this),
          OcpiEndpoint: OCPIEndpointService.handleGetOcpiEndpoint.bind(this),
          IntegrationConnections: ConnectorService.handleGetConnections.bind(this),
          IntegrationConnection: ConnectorService.handleGetConnection.bind(this),
          _default: UtilsService.handleUnknownAction.bind(this),
          Ping: (action: string, req: Request, res: Response, next: NextFunction) => res.sendStatus(200)
        });
        break;

      // Update
      case 'PUT':
        // Register REST actions
        this.registerJsonActionsPaths({
          PricingUpdate: PricingService.handleUpdatePricing.bind(this),
          UserUpdate: UserService.handleUpdateUser.bind(this),
          UpdateUserMobileToken: UserService.handleUpdateUserMobileToken.bind(this),
          ChargingStationUpdateParams: ChargingStationService.handleUpdateChargingStationParams.bind(this),
          ChargingStationLimitPower: ChargingStationService.handleChargingStationLimitPower.bind(this),
          ChargingProfileUpdate: ChargingStationService.handleUpdateChargingProfile.bind(this),
          TenantUpdate: TenantService.handleUpdateTenant.bind(this),
          SiteUpdate: SiteService.handleUpdateSite.bind(this),
          SiteAreaUpdate: SiteAreaService.handleUpdateSiteArea.bind(this),
          CompanyUpdate: CompanyService.handleUpdateCompany.bind(this),
          SiteUserAdmin: SiteService.handleUpdateSiteUserAdmin.bind(this),
          SiteOwner: SiteService.handleUpdateSiteOwner.bind(this),
          VehicleUpdate: VehicleService.handleUpdateVehicle.bind(this),
          VehicleManufacturerUpdate: VehicleManufacturerService.handleUpdateVehicleManufacturer.bind(this),
          TransactionSoftStop: TransactionService.handleTransactionSoftStop.bind(this),
          AssignTransactionsToUser: TransactionService.handleAssignTransactionsToUser.bind(this),
          SettingUpdate: SettingService.handleUpdateSetting.bind(this),
          OcpiEndpointUpdate: OCPIEndpointService.handleUpdateOcpiEndpoint.bind(this),
          OcpiEndpointRegister: OCPIEndpointService.handleRegisterOcpiEndpoint.bind(this),
          OcpiEndpointUnregister: OCPIEndpointService.handleUnregisterOcpiEndpoint.bind(this),
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
          ChargingStationDelete: ChargingStationService.handleDeleteChargingStation.bind(this),
          ChargingProfileDelete: ChargingStationService.handleDeleteChargingProfile.bind(this),
          VehicleDelete: VehicleService.handleDeleteVehicle.bind(this),
          VehicleManufacturerDelete: VehicleManufacturerService.handleDeleteVehicleManufacturer.bind(this),
          TransactionDelete: TransactionService.handleDeleteTransaction.bind(this),
          TransactionsDelete: TransactionService.handleDeleteTransactions.bind(this),
          IntegrationConnectionDelete: ConnectorService.handleDeleteConnection.bind(this),
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
    const action = /^\/\w*/g.exec(req.url)[0].substring(1);
    // Check Context
    switch (req.method) {
      // Create Request
      case 'GET':
        // Check Context
        switch (action) {
          // Ping
          case 'Ping':
            res.sendStatus(200);
            break;
          // FirmwareDownload
          case 'FirmwareDownload':
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
    const action = /^\/\w*/g.exec(req.url)[0].substring(1);

    // Check if User has been updated and require new login
    if (SessionHashService.isSessionHashUpdated(req, res, next)) {
      return;
    }

    // Check HTTP Verbs
    if (!['POST', 'GET', 'PUT', 'DELETE'].includes(req.method)) {
      Logging.logActionExceptionMessageAndSendResponse(
        'N/A', new Error(`Unsupported request method ${req.method}`), req, res, next);
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
