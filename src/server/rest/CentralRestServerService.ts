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

SourceMap.install();

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
    // Check Context
    switch (req.method) {
      // Create Request
      case "POST":
        // Check Context
        switch (action) {
          // Change max intensity
          case "ChargingStationSetMaxIntensitySocket":
            // Delegate
            action = action.slice(15);
            ChargingStationService.handleActionSetMaxIntensitySocket(action, req, res, next);
            break;
          // Charge Box
          case "ChargingStationClearCache":
          case "ChargingStationGetConfiguration":
          case "ChargingStationChangeConfiguration":
          case "ChargingStationRemoteStopTransaction":
          case "ChargingStationStopTransaction":
          case "ChargingStationRemoteStartTransaction":
          case "ChargingStationStartTransaction":
          case "ChargingStationUnlockConnector":
          case "ChargingStationReset":
          case "ChargingStationSetChargingProfile":
          case "ChargingStationGetCompositeSchedule":
          case "ChargingStationClearChargingProfile":
          case "ChargingStationGetDiagnostics":
          case "ChargingStationChangeAvailability":
          case "ChargingStationUpdateFirmware":
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
            break;
          // Add ChargingStations to SiteArea
          case "AddChargingStationsToSiteArea":
            // Delegate
            ChargingStationService.handleAddChargingStationsToSiteArea(action, req, res, next);
            break;
          // Remove ChargingStations from SiteArea
          case "RemoveChargingStationsFromSiteArea":
            // Delegate
            ChargingStationService.handleRemoveChargingStationsFromSiteArea(action, req, res, next);
            break;
          // Create User
          case "UserCreate":
            // Delegate
            UserService.handleCreateUser(action, req, res, next);
            break;
          // Create Company
          case "CompanyCreate":
            // Delegate
            CompanyService.handleCreateCompany(action, req, res, next);
            break;
          case "TenantCreate":
            TenantService.handleCreateTenant(action, req, res, next);
            break;
          // Create Vehicle
          case "VehicleCreate":
            // Delegate
            VehicleService.handleCreateVehicle(action, req, res, next);
            break;
          // Create Vehicle Manufacturer
          case "VehicleManufacturerCreate":
            // Delegate
            VehicleManufacturerService.handleCreateVehicleManufacturer(action, req, res, next);
            break;
          // Create Site
          case "SiteCreate":
            // Delegate
            SiteService.handleCreateSite(action, req, res, next);
            break;
          // Add Users to Site
          case "AddUsersToSite":
            // Delegate
            SiteService.handleAddUsersToSite(action, req, res, next);
            break;
          // Remove Users to Site
          case "RemoveUsersFromSite":
            // Delegate
            SiteService.handleRemoveUsersFromSite(action, req, res, next);
            break;
          // Add Sites to User
          case "AddSitesToUser":
            // Delegate
            UserService.handleAddSitesToUser(action, req, res, next);
            break;
          // Remove Sites from User
          case "RemoveSitesFromUser":
            // Delegate
            UserService.handleRemoveSitesFromUser(action, req, res, next);
            break;
          // Create Site Area
          case "SiteAreaCreate":
            // Delegate
            SiteAreaService.handleCreateSiteArea(action, req, res, next);
            break;
          // Transaction Refund
          case "TransactionsRefund":
            // Delegate
            TransactionService.handleRefundTransactions(action, req, res, next);
            break;
          // Create Setting
          case "SettingCreate":
            // Delegate
            SettingService.handleCreateSetting(action, req, res, next);
            break;
          // Create OcpiEndpoint
          case "OcpiEndpointCreate":
            // Delegate
            OCPIEndpointService.handleCreateOcpiEndpoint(action, req, res, next);
            break;
          // Ping OcpiEndpoint
          case "OcpiEndpointPing":
            // Delegate
            OCPIEndpointService.handlePingOcpiEndpoint(action, req, res, next);
            break;
          // SendEVSEStatuses to OcpiEndpoint
          case "OcpiEndpointSendEVSEStatuses":
            // Delegate
            OCPIEndpointService.handleSendEVSEStatusesOcpiEndpoint(action, req, res, next);
            break;
          // Generate Local Token OcpiEndpoint
          case "OcpiEndpointGenerateLocalToken":
            // Delegate
            OCPIEndpointService.handleGenerateLocalTokenOcpiEndpoint(action, req, res, next);
            break;
          case "IntegrationConnectionCreate":
            ConnectorService.handleCreateConnection(action, req, res, next);
            break;
          // Unknown Context
          default:
            // Delegate
            UtilsService.handleUnknownAction(action, req, res, next);
        }
        break;

      // Get Request
      case "GET":
        // Check Action
        switch (action) {
          // Ping
          case "Ping":
            res.sendStatus(200);
            break;
          // Get Pricing
          case "Pricing":
            // Delegate
            PricingService.handleGetPricing(action, req, res, next);
            break;
          // Get the Logging
          case "Loggings":
            // Delegate
            LoggingService.handleGetLoggings(action, req, res, next);
            break;
          // Get the Logging
          case "Logging":
            // Delegate
            LoggingService.handleGetLogging(action, req, res, next);
            break;
          case "LoggingsExport":
            // Delegate
            LoggingService.handleGetLoggingsExport(action, req, res, next);
            break;
          // Get all the charging stations
          case "ChargingStations":
            // Delegate
            ChargingStationService.handleGetChargingStations(action, req, res, next);
            break;
          case "ChargingStationsExport":
            // Delegate
            ChargingStationService.handleGetChargingStationsExport(action, req, res, next);
            break;
          // Get one charging station
          case "ChargingStation":
            // Delegate
            ChargingStationService.handleGetChargingStation(action, req, res, next);
            break;
          // Get all status notifications
          case "StatusNotifications":
            // Delegate
            ChargingStationService.handleGetStatusNotifications(action, req, res, next);
            break;
          // Get all boot notifications
          case "BootNotifications":
            // Delegate
            ChargingStationService.handleGetBootNotifications(action, req, res, next);
            break;
          // Get all the companies
          case "Companies":
            // Delegate
            CompanyService.handleGetCompanies(action, req, res, next);
            break;
          // Get one company
          case "Company":
            // Delegate
            CompanyService.handleGetCompany(action, req, res, next);
            break;
          // Get one company logo
          case "CompanyLogo":
            // Delegate
            CompanyService.handleGetCompanyLogo(action, req, res, next);
            break;
          // Get all the sites
          case "Sites":
            // Delegate
            SiteService.handleGetSites(action, req, res, next);
            break;
          // Get one site
          case "Site":
            // Delegate
            SiteService.handleGetSite(action, req, res, next);
            break;
          // Get one site image
          case "SiteImage":
            // Delegate
            SiteService.handleGetSiteImage(action, req, res, next);
            break;
          case "SiteUsers":
            SiteService.handleGetUsers(action, req, res, next);
            break;
          // Get all tenant
          case "Tenants":
            TenantService.handleGetTenants(action, req, res, next);
            break;
          // Get one tenant
          case "Tenant":
            TenantService.handleGetTenant(action, req, res, next);
            break;
          // Get all the vehicles
          case "Vehicles":
            // Delegate
            VehicleService.handleGetVehicles(action, req, res, next);
            break;
          // Get one vehicle
          case "Vehicle":
            // Delegate
            VehicleService.handleGetVehicle(action, req, res, next);
            break;
          // Get all the vehicle images
          case "VehicleImages":
            // Delegate
            VehicleService.handleGetVehicleImages(action, req, res, next);
            break;
          // Get one vehicle image
          case "VehicleImage":
            // Delegate
            VehicleService.handleGetVehicleImage(action, req, res, next);
            break;
          // Get all the Vehicle Manufacturers
          case "VehicleManufacturers":
            // Delegate
            VehicleManufacturerService.handleGetVehicleManufacturers(action, req, res, next);
            break;
          // Get one Vehicle Manufacturer
          case "VehicleManufacturer":
            // Delegate
            VehicleManufacturerService.handleGetVehicleManufacturer(action, req, res, next);
            break;
          // Get all the Vehicle Manufacturer logos
          case "VehicleManufacturerLogos":
            // Delegate
            VehicleManufacturerService.handleGetVehicleManufacturerLogos(action, req, res, next);
            break;
          // Get one Vehicle Manufacturer logo
          case "VehicleManufacturerLogo":
            // Delegate
            VehicleManufacturerService.handleGetVehicleManufacturerLogo(action, req, res, next);
            break;
          // Get all the site areas
          case "SiteAreas":
            // Delegate
            SiteAreaService.handleGetSiteAreas(action, req, res, next);
            break;
          // Get one site area
          case "SiteArea":
            // Delegate
            SiteAreaService.handleGetSiteArea(action, req, res, next);
            break;
          // Get one site area image
          case "SiteAreaImage":
            // Delegate
            SiteAreaService.handleGetSiteAreaImage(action, req, res, next);
            break;
          // Get all the users
          case "Users":
            // Delegate
            UserService.handleGetUsers(action, req, res, next);
            break;
          // Get users in error
          case "UsersInError":
            // Delegate
            UserService.handleGetUsersInError(action, req, res, next);
            break;
          // Get the user images
          case "UserImages":
            // Delegate
            UserService.handleGetUserImages(action, req, res, next);
            break;
          // Get the user
          case "User":
            // Delegate
            UserService.handleGetUser(action, req, res, next);
            break;
          // Get the user
          case "UserInvoice":
            // Delegate
            UserService.handleGetUserInvoice(action, req, res, next);
            break;
          // Get the notifications
          case "Notifications":
            // Delegate
            NotificationService.handleGetNotifications(action, req, res, next);
            break;
          // Get the user image
          case "UserImage":
            // Delegate
            UserService.handleGetUserImage(action, req, res, next);
            break;
          // Get the completed transactions
          case "TransactionsCompleted":
            // Delegate
            TransactionService.handleGetTransactionsCompleted(action, req, res, next);
            break;
          // Get the completed transactions
          case "TransactionsExport":
            // Delegate
            TransactionService.handleGetTransactionsExport(action, req, res, next);
            break;
          // Get transactions in error
          case "TransactionsInError":
            // Delegate
            TransactionService.handleGetTransactionsInError(action, req, res, next);
            break;
          // Get the transaction's years
          case "TransactionYears":
            // Delegate
            TransactionService.handleGetTransactionYears(action, req, res, next);
            break;
          // Get the consumption statistics
          case "ChargingStationConsumptionStatistics":
            // Delegate
            StatisticService.handleGetChargingStationConsumptionStatistics(action, req, res, next);
            break;
          // Get the consumption statistics
          case "ChargingStationUsageStatistics":
            // Delegate
            StatisticService.handleGetChargingStationUsageStatistics(action, req, res, next);
            break;
          // Get the inactivity statistics
          case "ChargingStationInactivityStatistics":
            // Delegate
            StatisticService.handleGetChargingStationInactivityStatistics(action, req, res, next);
            break;
            // Export the statistics data
          case "StatisticsExport":
            // Delegate
            StatisticService.handleGetStatisticsExport(action, req, res, next);
            break;
          // Get the current metrics
          case "CurrentMetrics":
            // Delegate
            StatisticService.handleGetCurrentMetrics(action, req, res, next);
            break;
          // Get the consumption statistics
          case "UserConsumptionStatistics":
            // Delegate
            StatisticService.handleGetUserConsumptionStatistics(action, req, res, next);
            break;
          // Get the usage statistics
          case "UserUsageStatistics":
            // Delegate
            StatisticService.handleGetUserUsageStatistics(action, req, res, next);
            break;
          // Get the inactivity statistics
          case "UserInactivityStatistics":
            // Delegate
            StatisticService.handleGetUserInactivityStatistics(action, req, res, next);
            break;
            // Get the active transactions
          case "TransactionsActive":
            // Delegate
            TransactionService.handleGetTransactionsActive(action, req, res, next);
            break;
          // Get the transactions
          case "ChargingStationTransactions":
            // Delegate
            TransactionService.handleGetChargingStationTransactions(action, req, res, next);
            break;
          // Get the transaction
          case "Transaction":
            // Delegate
            TransactionService.handleGetTransaction(action, req, res, next);
            break;
          // Get Charging Consumption
          case "ChargingStationConsumptionFromTransaction":
            // Delegate
            TransactionService.handleGetChargingStationConsumptionFromTransaction(action, req, res, next);
            break;
          // Get Charging Configuration
          case "ChargingStationConfiguration":
            // Delegate
            ChargingStationService.handleGetChargingStationConfiguration(action, req, res, next);
            break;
          // Request Charging Configuration
          case "ChargingStationRequestConfiguration":
            // Delegate
            ChargingStationService.handleRequestChargingStationConfiguration(action, req, res, next);
            break;
          // Get chargers in error
          case "ChargingStationsInError":
            // Delegate
            ChargingStationService.handleGetChargingStationsInError(action, req, res, next);
            break;
          // Authorization
          case "IsAuthorized":
            // Delegate
            AuthService.handleIsAuthorized(action, req, res, next);
            break;
          // Get all the settings
          case "Settings":
            // Delegate
            SettingService.handleGetSettings(action, req, res, next);
            break;
          // Get one setting
          case "Setting":
            // Delegate
            SettingService.handleGetSetting(action, req, res, next);
            break;
          // Get all the ocpiendpoints
          case "OcpiEndpoints":
            // Delegate
            OCPIEndpointService.handleGetOcpiEndpoints(action, req, res, next);
            break;
          // Get one ocpiendpoint
          case "OcpiEndpoint":
            // Delegate
            OCPIEndpointService.handleGetOcpiEndpoint(action, req, res, next);
            break;
          case "IntegrationConnections":
            ConnectorService.handleGetConnections(action, req, res, next);
            break;
          case "IntegrationConnection":
            ConnectorService.handleGetConnection(action, req, res, next);
            break;
          // Unknown Action
          default:
            // Delegate
            UtilsService.handleUnknownAction(action, req, res, next);
        }
        break;

      // Update Request
      case "PUT":
        // Check
        switch (action) {
          // Change Pricing
          case "PricingUpdate":
            // Delegate
            PricingService.handleUpdatePricing(action, req, res, next);
            break;
          // User
          case "UserUpdate":
            // Delegate
            UserService.handleUpdateUser(action, req, res, next);
            break;
          // Charging Station Params
          case "ChargingStationUpdateParams":
            // Delegate
            ChargingStationService.handleUpdateChargingStationParams(action, req, res, next);
            break;
          // Tenant
          case "TenantUpdate":
            // Delegate
            TenantService.handleUpdateTenant(action, req, res, next);
            break;
          // Site
          case "SiteUpdate":
            // Delegate
            SiteService.handleUpdateSite(action, req, res, next);
            break;
          // Site Area
          case "SiteAreaUpdate":
            // Delegate
            SiteAreaService.handleUpdateSiteArea(action, req, res, next);
            break;
          case "SiteUserAdmin":
            // Delegate
            SiteService.handleUpdateSiteUserAdmin(action, req, res, next);
            break;
          // Company
          case "CompanyUpdate":
            // Delegate
            CompanyService.handleUpdateCompany(action, req, res, next);
            break;
          // Vehicle
          case "VehicleUpdate":
            // Delegate
            VehicleService.handleUpdateVehicle(action, req, res, next);
            break;
          // Vehicle Manufacturer
          case "VehicleManufacturerUpdate":
            // Delegate
            VehicleManufacturerService.handleUpdateVehicleManufacturer(action, req, res, next);
            break;
          // Transaction
          case "TransactionSoftStop":
            // Delegate
            TransactionService.handleTransactionSoftStop(action, req, res, next);
            break;
          // Setting
          case "SettingUpdate":
            // Delegate
            SettingService.handleUpdateSetting(action, req, res, next);
            break;
          // OcpiEndpoint
          case "OcpiEndpointUpdate":
            // Delegate
            OCPIEndpointService.handleUpdateOcpiEndpoint(action, req, res, next);
            break;
          case "OcpiEndpointRegister":
            // Delegate
            OCPIEndpointService.handleRegisterOcpiEndpoint(action, req, res, next);
            break;
          // Not found
          default:
            // Delegate
            UtilsService.handleUnknownAction(action, req, res, next);
        }
        break;

      // Delete Request
      case "DELETE":
        // Check
        switch (action) {
          // User
          case "UserDelete":
            // Delegate
            UserService.handleDeleteUser(action, req, res, next);
            break;
          // Company
          case "CompanyDelete":
            // Delegate
            CompanyService.handleDeleteCompany(action, req, res, next);
            break;
          // Vehicle
          case "VehicleDelete":
            // Delegate
            VehicleService.handleDeleteVehicle(action, req, res, next);
            break;
          // Vehicle Manufacturer
          case "VehicleManufacturerDelete":
            // Delegate
            VehicleManufacturerService.handleDeleteVehicleManufacturer(action, req, res, next);
            break;
          // Tenant
          case "TenantDelete":
            // Delegate
            TenantService.handleDeleteTenant(action, req, res, next);
            break;
          // Site
          case "SiteDelete":
            // Delegate
            SiteService.handleDeleteSite(action, req, res, next);
            break;
          // Site Area
          case "SiteAreaDelete":
            // Delegate
            SiteAreaService.handleDeleteSiteArea(action, req, res, next);
            break;
          // Charging station
          case "ChargingStationDelete":
            // Delegate
            ChargingStationService.handleDeleteChargingStation(action, req, res, next);
            break;
          // Transaction
          case "TransactionDelete":
            // Delegate
            TransactionService.handleDeleteTransaction(action, req, res, next);
            break;
          case "IntegrationConnectionDelete":
            ConnectorService.handleDeleteConnection(action, req, res, next);
            break;
          // Setting
          case "SettingDelete":
            // Delegate
            SettingService.handleDeleteSetting(action, req, res, next);
            break;
          // OcpiEndpoint
          case "OcpiEndpointDelete":
            // Delegate
            OCPIEndpointService.handleDeleteOcpiEndpoint(action, req, res, next);
            break;
          // Not found
          default:
            // Delegate
            UtilsService.handleUnknownAction(action, req, res, next);
        }
        break;

      default:
        // Log
        Logging.logActionExceptionMessageAndSendResponse(
          "N/A", new Error(`Unsupported request method ${req.method}`), req, res, next);
        break;
    }
  }
};
