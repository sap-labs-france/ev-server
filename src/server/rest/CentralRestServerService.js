const Logging = require('../../utils/Logging');
const ChargingStationService = require('./service/ChargingStationService');
const VehicleManufacturerService = require('./service/VehicleManufacturerService');
const AuthService = require('./service/AuthService');
const UserService = require('./service/UserService');
const CompanyService = require('./service/CompanyService');
const SiteService = require('./service/SiteService');
const SiteAreaService = require('./service/SiteAreaService');
const PricingService = require('./service/PricingService');
const VehicleService = require('./service/VehicleService');
const UtilsService = require('./service/UtilsService');
const LoggingService = require('./service/LoggingService');
const TransactionService = require('./service/TransactionService');
const StatisticService = require('./service/StatisticService');
const TenantService = require('./service/TenantService');
const SettingService = require('./service/SettingService');
const OcpiendpointService = require('./service/OcpiendpointService');

require('source-map-support').install();

module.exports = {
  // Util Service
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

  restServiceSecured(req, res, next) {
    // Parse the action
    let action = /^\/\w*/g.exec(req.url)[0].substring(1);
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
          case "ChargingStationStopTransaction":
          case "ChargingStationStartTransaction":
          case "ChargingStationUnlockConnector":
          case "ChargingStationReset":
            // Keep the action (remove ChargingStation)
            action = action.slice(15);
            // Delegate
            ChargingStationService.handleAction(action, req, res, next);
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
          case "TransactionRefund":
            // Delegate
            TransactionService.handleRefundTransaction(action, req, res, next);
            break;
          // Create Setting
          case "SettingCreate":
            // Delegate
            SettingService.handleCreateSetting(action, req, res, next);
            break;
          // Create Ocpiendpoint
          case "OcpiendpointCreate":
            // Delegate
            OcpiendpointService.handleCreateOcpiendpoint(action, req, res, next);
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
          // Get all the charging stations
          case "ChargingStations":
            // Delegate
            ChargingStationService.handleGetChargingStations(action, req, res, next);
            break;
          // Get one charging station
          case "ChargingStation":
            // Delegate
            ChargingStationService.handleGetChargingStation(action, req, res, next);
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
          // Get all the company logos
          case "CompanyLogos":
            // Delegate
            CompanyService.handleGetCompanyLogos(action, req, res, next);
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
          // Get all the site images
          case "SiteImages":
            // Delegate
            SiteService.handleGetSiteImages(action, req, res, next);
            break;
          // Get one site image
          case "SiteImage":
            // Delegate
            SiteService.handleGetSiteImage(action, req, res, next);
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
          // Get all the site area images
          case "SiteAreaImages":
            // Delegate
            SiteAreaService.handleGetSiteAreaImages(action, req, res, next);
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
          // Get the consumption statistics
          case "UserConsumptionStatistics":
            // Delegate
            StatisticService.handleGetUserConsumptionStatistics(action, req, res, next);
            break;
          // Get the usage statistics
          case "UserUsageStatistics":
            // Delegate
            StatisticService.handleUserUsageStatistics(action, req, res, next);
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
          case "Ocpiendpoints":
            // Delegate
            OcpiendpointService.handleGetOcpiendpoints(action, req, res, next);
            break;
          // Get one ocpiendpoint
          case "Ocpiendpoint":
            // Delegate
            OcpiendpointService.handleGetOcpiendpoint(action, req, res, next);
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
          // Ocpiendpoint
          case "OcpiendpointUpdate":
            // Delegate
            OcpiendpointService.handleUpdateOcpiendpoint(action, req, res, next);
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
          // Setting
          case "SettingDelete":
            // Delegate
            SettingService.handleDeleteSetting(action, req, res, next);
            break;
          // Ocpiendpoint
          case "OcpiendpointDelete":
            // Delegate
            OcpiendpointService.handleDeleteOcpiendpoint(action, req, res, next);
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
