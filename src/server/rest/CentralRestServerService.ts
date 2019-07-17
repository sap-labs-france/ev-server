import { NextFunction, Request, Response } from 'express';
import AuthService from './service/AuthService';
import ChargingStationService from './service/ChargingStationService';
import CompanyService from './service/CompanyService';
import ConnectorService from './service/ConnectorService';
import Logging from '../../utils/Logging';
import LoggingService from './service/LoggingService';
import NotificationService from './service/NotificationService';
import OCPIEndpointService from './service/OCPIEndpointService';
import PricingService from './service/PricingService';
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
          (action: string, req: Request, res: Response, next: NextFunction) => {
            action = action.slice(15);
            ChargingStationService.handleActionSetMaxIntensitySocket(action, req, res, next);
          },
          'ChargingStationSetMaxIntensitySocket'
        );
        this.registerOneActionManyPaths(
          (action: string, req: Request, res: Response, next: NextFunction) => {
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
            // Delegate
            ChargingStationService.handleAction(action, req, res, next);
          },
          'ChargingStationClearCache',
          'ChargingStationGetConfiguration',
          'ChargingStationChangeConfiguration',
          'ChargingStationStopTransaction',
          'ChargingStationStartTransaction',
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
          AddChargingStationsToSiteArea: ChargingStationService.handleAddChargingStationsToSiteArea,
          RemoveChargingStationsFromSiteArea: ChargingStationService.handleRemoveChargingStationsFromSiteArea,
          UserCreate: UserService.handleCreateUser,
          CompanyCreate: CompanyService.handleCreateCompany,
          TenantCreate: TenantService.handleCreateTenant,
          VehicleCreate: VehicleService.handleCreateVehicle,
          VehicleManufacturerCreate: VehicleManufacturerService.handleCreateVehicleManufacturer,
          SiteCreate: SiteService.handleCreateSite,
          AddUsersToSite: SiteService.handleAddUsersToSite,
          RemoveUsersFromSite: SiteService.handleRemoveUsersFromSite,
          AddSitesToUser: UserService.handleAssignSitesToUser,
          RemoveSitesFromUser: UserService.handleAssignSitesToUser,
          SiteAreaCreate: SiteAreaService.handleCreateSiteArea,
          TransactionsRefund: TransactionService.handleRefundTransactions,
          SettingCreate: SettingService.handleCreateSetting,
          OcpiEndpointCreate: OCPIEndpointService.handleCreateOcpiEndpoint,
          OcpiEndpointPing: OCPIEndpointService.handlePingOcpiEndpoint,
          OcpiEndpointSendEVSEStatuses: OCPIEndpointService.handleSendEVSEStatusesOcpiEndpoint,
          OcpiEndpointGenerateLocalToken: OCPIEndpointService.handleGenerateLocalTokenOcpiEndpoint,
          IntegrationConnectionCreate: ConnectorService.handleCreateConnection,
          _default: UtilsService.handleUnknownAction
        });
        break;

      // Read
      case 'GET':
        // Register REST actions
        this.registerJsonActionsPaths({
          Pricing: PricingService.handleGetPricing,
          Loggings: LoggingService.handleGetLoggings,
          Logging: LoggingService.handleGetLogging,
          LoggingsExport: LoggingService.handleGetLoggingsExport,
          ChargingStations: ChargingStationService.handleGetChargingStations,
          ChargingStationsExport: ChargingStationService.handleGetChargingStationsExport,
          ChargingStation: ChargingStationService.handleGetChargingStation,
          StatusNotifications: ChargingStationService.handleGetStatusNotifications,
          BootNotifications: ChargingStationService.handleGetBootNotifications,
          Companies: CompanyService.handleGetCompanies,
          Company: CompanyService.handleGetCompany,
          CompanyLogo: CompanyService.handleGetCompanyLogo,
          Sites: SiteService.handleGetSites,
          Site: SiteService.handleGetSite,
          SiteImage: SiteService.handleGetSiteImage,
          SiteUsers: SiteService.handleGetUsers,
          Tenants: TenantService.handleGetTenants,
          Tenant: TenantService.handleGetTenant,
          Vehicles: VehicleService.handleGetVehicles,
          Vehicle: VehicleService.handleGetVehicle,
          VehicleImages: VehicleService.handleGetVehicleImages,
          VehicleImage: VehicleService.handleGetVehicleImage,
          VehicleManufacturers: VehicleManufacturerService.handleGetVehicleManufacturers,
          VehicleManufacturer: VehicleManufacturerService.handleGetVehicleManufacturer,
          VehicleManufacturerLogos: VehicleManufacturerService.handleGetVehicleManufacturerLogos,
          VehicleManufacturerLogo: VehicleManufacturerService.handleGetVehicleManufacturerLogo,
          SiteAreas: SiteAreaService.handleGetSiteAreas,
          SiteArea: SiteAreaService.handleGetSiteArea,
          SiteAreaImage: SiteAreaService.handleGetSiteAreaImage,
          Users: UserService.handleGetUsers,
          UsersInError: UserService.handleGetUsersInError,
          UserImages: UserService.handleGetUserImages,
          UserImage: UserService.handleGetUserImage,
          User: UserService.handleGetUser,
          UserInvoice: UserService.handleGetUserInvoice,
          Notifications: NotificationService.handleGetNotifications,
          TransactionsCompleted: TransactionService.handleGetTransactionsCompleted,
          TransactionsExport: TransactionService.handleGetTransactionsExport,
          TransactionsActive: TransactionService.handleGetTransactionsActive,
          TransactionsInError: TransactionService.handleGetTransactionsInError,
          TransactionYears: TransactionService.handleGetTransactionYears,
          ChargingStationConsumptionStatistics: StatisticService.handleGetChargingStationConsumptionStatistics,
          ChargingStationUsageStatistics: StatisticService.handleGetChargingStationUsageStatistics,
          ChargingStationInactivityStatistics: StatisticService.handleGetChargingStationInactivityStatistics,
          CurrentMetrics: StatisticService.handleGetCurrentMetrics,
          StatisticsExport: StatisticService.handleGetStatisticsExport,
          UserConsumptionStatistics: StatisticService.handleGetUserConsumptionStatistics,
          UserUsageStatistics: StatisticService.handleGetUserUsageStatistics,
          UserInactivityStatistics: StatisticService.handleGetUserInactivityStatistics,
          ChargingStationTransactions: TransactionService.handleGetChargingStationTransactions,
          Transaction: TransactionService.handleGetTransaction,
          ChargingStationConsumptionFromTransaction: TransactionService.handleGetChargingStationConsumptionFromTransaction,
          ChargingStationConfiguration: ChargingStationService.handleGetChargingStationConfiguration,
          ChargingStationRequestConfiguration: ChargingStationService.handleRequestChargingStationConfiguration,
          ChargingStationsInError: ChargingStationService.handleGetChargingStationsInError,
          IsAuthorized: AuthService.handleIsAuthorized,
          Settings: SettingService.handleGetSettings,
          Setting: SettingService.handleGetSetting,
          OcpiEndpoints: OCPIEndpointService.handleGetOcpiEndpoints,
          OcpiEndpoint: OCPIEndpointService.handleGetOcpiEndpoint,
          IntegrationConnections: ConnectorService.handleGetConnections,
          IntegrationConnection: ConnectorService.handleGetConnection,
          _default: UtilsService.handleUnknownAction,
          Ping: (action: string, req: Request, res: Response, next: NextFunction) => {
            return res.sendStatus(200);
          }
        });
        break;

      // Update
      case 'PUT':
        // Register REST actions
        this.registerJsonActionsPaths({
          PricingUpdate: PricingService.handleUpdatePricing,
          UserUpdate: UserService.handleUpdateUser,
          ChargingStationUpdateParams: ChargingStationService.handleUpdateChargingStationParams,
          TenantUpdate: TenantService.handleUpdateTenant,
          SiteUpdate: SiteService.handleUpdateSite,
          SiteAreaUpdate: SiteAreaService.handleUpdateSiteArea,
          CompanyUpdate: CompanyService.handleUpdateCompany,
          SiteUserAdmin: SiteService.handleUpdateSiteUserAdmin,
          VehicleUpdate: VehicleService.handleUpdateVehicle,
          VehicleManufacturerUpdate: VehicleManufacturerService.handleUpdateVehicleManufacturer,
          TransactionSoftStop: TransactionService.handleTransactionSoftStop,
          SettingUpdate: SettingService.handleUpdateSetting,
          OcpiEndpointUpdate: OCPIEndpointService.handleUpdateOcpiEndpoint,
          OcpiEndpointRegister: OCPIEndpointService.handleRegisterOcpiEndpoint,
          _default: UtilsService.handleUnknownAction
        });
        break;

      // Delete
      case 'DELETE':
        // Register REST actions
        this.registerJsonActionsPaths({
          UserDelete: UserService.handleDeleteUser,
          TenantDelete: TenantService.handleDeleteTenant,
          SiteDelete: SiteService.handleDeleteSite,
          SiteAreaDelete: SiteAreaService.handleDeleteSiteArea,
          CompanyDelete: CompanyService.handleDeleteCompany,
          ChargingStationDelete: ChargingStationService.handleDeleteChargingStation,
          VehicleDelete: VehicleService.handleDeleteVehicle,
          VehicleManufacturerDelete: VehicleManufacturerService.handleDeleteVehicleManufacturer,
          TransactionDelete: TransactionService.handleDeleteTransaction,
          IntegrationConnectionDelete: ConnectorService.handleDeleteConnection,
          SettingDelete: SettingService.handleDeleteSetting,
          OcpiEndpointDelete: OCPIEndpointService.handleDeleteOcpiEndpoint,
          _default: UtilsService.handleUnknownAction
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
  restServiceUtil(req, res, next) {
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
        }
        break;
    }
  },

  async restServiceSecured(req, res, next) {
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
      // Log
      console.log(error);
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
};
