import Logging from '../../utils/Logging';
import ChargingStationService from './service/ChargingStationService';
import VehicleManufacturerService from './service/VehicleManufacturerService';
import AuthService from './service/AuthService';
import UserService from './service/UserService';
import CompanyService from './service/CompanyService';
import SiteService from './service/SiteService';
import SiteAreaService from './service/SiteAreaService';
import PricingService from './service/PricingService';
import VehicleService from './service/VehicleService';
import UtilsService from './service/UtilsService';
import LoggingService from './service/LoggingService';
import TransactionService from './service/TransactionService';
import StatisticService from './service/StatisticService';
import TenantService from './service/TenantService';
import SettingService from './service/SettingService';
import OCPIEndpointService from './service/OCPIEndpointService';
import NotificationService from './service/NotificationService';
import ConnectorService from './service/ConnectorService';
import SessionHashService from './service/SessionHashService';
import SourceMap from 'source-map-support';
import { Request, Response, NextFunction } from 'express';

SourceMap.install();

class RequestMapper {
  
  private paths = new Map<string, number>();
  private actions = new Array<Function>();
  private static instances = new Map<string, RequestMapper>();

  private constructor(method: string){
    switch(method) {
      case 'POST':
        this.registerRequest((action: string, req: Request, res: Response, next: NextFunction)=>{
          action = action.slice(15);
          ChargingStationService.handleActionSetMaxIntensitySocket(action, req, res, next);
        }, 'ChargingStationSetMaxIntensitySocket');
        this.registerRequest((action: string, req: Request, res: Response, next: NextFunction)=>{
           // Keep the action (remove ChargingStation)
           action = action.slice(15);
           // TODO: To Remove
           // Hack for mobile app not sending the RemoteStopTransaction yet
           if (action === "StartTransaction") {
             action = "RemoteStartTransaction";
           }
           if (action === "StopTransaction") {
             action = "RemoteStopTransaction";
           }
           // Delegate
           ChargingStationService.handleAction(action, req, res, next);
        },  "ChargingStationClearCache", 
            "ChargingStationGetConfiguration", 
            "ChargingStationChangeConfiguration", 
            "ChargingStationStopTransaction", 
            "ChargingStationStartTransaction", 
            "ChargingStationUnlockConnector", 
            "ChargingStationReset", 
            "ChargingStationSetChargingProfile", 
            "ChargingStationGetCompositeSchedule", 
            "ChargingStationClearChargingProfile", 
            "ChargingStationGetDiagnostics", 
            "ChargingStationChangeAvailability", 
            "ChargingStationUpdateFirmware")
        this.registerRequests1To1Shortcut({
          AddChargingStationsToSiteArea: ChargingStationService.handleAddChargingStationsToSiteArea,
          RemoveChargingStationsFromSiteArea: ChargingStationService.handleRemoveChargingStationsFromSiteArea,
          CreateUser: UserService.handleCreateUser,
          CompanyCreate: CompanyService.handleCreateCompany,
          TenantCreate: TenantService.handleCreateTenant,
          VehicleCreate: VehicleService.handleCreateVehicle,
          VehicleManufacturerCreate: VehicleManufacturerService.handleCreateVehicleManufacturer,
          SiteCreate: SiteService.handleCreateSite,
          AddUsersToSite: SiteService.handleAddUsersToSite,
          RemoveUsersFromSite: SiteService.handleRemoveUsersFromSite,
          AddSitesToUser: UserService.handleAddSitesToUser,
          RemoveSitesFromUser: UserService.handleRemoveSitesFromUser,
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
      case 'GET':
        this.registerRequests1To1Shortcut({
          Pricing: PricingService.handleGetPricing,
          Loggings: LoggingService.handleGetLoggings,
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
          CurrentMetrics: StatisticService.handleGetCurrentMetrics,
          UserConsumptionStatistics: StatisticService.handleGetUserConsumptionStatistics,
          UserUsageStatistics: StatisticService.handleUserUsageStatistics,
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
          Ping: (action: string, req: Request, res: Response, next: NextFunction) => res.sendStatus(200)
        });
      case 'PUT':
        this.registerRequests1To1Shortcut({
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
      case 'DELETE':
        this.registerRequests1To1Shortcut({
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
    }
  }

  public static instance(method: string): RequestMapper {
    if(! this.instances.has(method)) {
      this.instances.set(method, new RequestMapper(method));
    }
    return this.instances.get(method);
  }

  public registerRequest(action: Function, ...paths: string[]) {
    let index = this.actions.push(action) - 1;
    for(let path of paths) {
      this.paths.set(path, index);
    }
  }

  public registerRequests1To1Shortcut(dict: any) {
    for(let key in dict) {
      this.registerRequest(dict[key], key);
    }
  }

  public getAction(path: string): Function {
    if(!this.paths.has(path)){
      path = '_default';
    }
    return this.actions[this.paths.get(path)];
  }

  //TODO: no static servics; instantiate them & let them register their own actions
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
      case "GET":
        // Check Context
        switch (action) {
          // Ping
          case "Ping":
            res.sendStatus(200);
            break;
        }
        break;
    }
  },

  async restServiceSecured(req, res, next) {
    // Parse the action
    let action = /^\/\w*/g.exec(req.url)[0].substring(1);

    // Check if User has been updated and require new login
    if (await SessionHashService.isSessionHashUpdated(req, res, next)) {
      return;
    }
    if(! ['POST', 'GET', 'PUT', 'DELETE'].includes(req.method)){
      Logging.logActionExceptionMessageAndSendResponse(
        "N/A", new Error(`Unsupported request method ${req.method}`), req, res, next);
      return;
    }

    try{
      console.log(req.method + ' ' + action);
      RequestMapper.instance(req.method).getAction(action)(action, req, res, next); //TODO
    
    }catch(error){
      console.log(error);
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
};
