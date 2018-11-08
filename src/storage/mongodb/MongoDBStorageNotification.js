const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const TenantStorage = require('./TenantStorage');

require('source-map-support').install();

const _pipeline = [];
const _options = {
  'fullDocument': 'updateLookup'
};

class MongoDBStorageNotification {
  constructor(dbConfig, database, centralRestServer){
    this.dbConfig = dbConfig;
    this.database = database;
    this.centralRestServer = centralRestServer;
  }

  static getActionFromOperation(operation){
    switch (operation) {
      case 'insert': // Insert/Create
        return Constants.ACTION_CREATE;
      case 'update': // Update
        return Constants.ACTION_UPDATE;
      case 'delete': // Delete
        return Constants.ACTION_DELETE;
    }
    return null;
  }

  async start(){
    if (this.dbConfig.monitorDBChange) {
      Logging.logInfo({
        module: "MongoDBStorageNotification", method: "start", action: "Startup",
        message: `Starting to monitor changes on database ''${this.dbConfig.implementation}'...`
      });
      // Start Listening
      this.watchDefaultTenant();
      this.watchTenants();

      Logging.logInfo({
        module: "MongoDBStorageNotification", method: "start", action: "Startup",
        message: `The monitoring on database '${this.dbConfig.implementation}' is active`
      });
    } else {
      Logging.logInfo({
        module: "MongoDBStorageNotification", method: "start", action: "Startup",
        message: `The monitoring on database '${this.dbConfig.implementation}' is disabled`
      });
    }
  }

  async watchDefaultTenant(){
    // Logs
    this.watchCollection(Constants.DEFAULT_TENANT, "logs", this.centralRestServer.notifyLogging.bind(this.centralRestServer), false);
    // Users
    this.watchCollection(Constants.DEFAULT_TENANT, "users", this.centralRestServer.notifyUser.bind(this.centralRestServer), true);
    // User Images
    this.watchCollection(Constants.DEFAULT_TENANT, "userimages", this.centralRestServer.notifyUser.bind(this.centralRestServer), true);
  }

  async watchTenants(){
    // Check
    if (!this.centralRestServer) {
      return;
    }

    const tenants = await TenantStorage.getTenants();
    for (const tenant of tenants.result) {
      Logging.logInfo({
        module: "MongoDBStorageNotification", method: "watchTenants", action: "Startup",
        message: `Watching collections of tenant ${tenant.getName()}`
      });
      this.watchTenantCollections(tenant.getID());
    }
    // Watch tenant collection
    const tenantsWatcher = await this.database.getCollection(Constants.DEFAULT_TENANT, "tenants").watch(_pipeline, _options);
    tenantsWatcher.on("change", (change) => {
      const action = MongoDBStorageNotification.getActionFromOperation(change.operationType);
      const tenantID = change.documentKey._id.toString();
      switch (action) {
        case Constants.ACTION_CREATE:
          this.watchTenantCollections(tenantID);
          break;
      }
      // Notify
      this.centralRestServer.notifyTenant(Constants.DEFAULT_TENANT, action, {id: tenantID});
    });
  }

  async watchTenantCollections(tenantID){
    // Logs
    this.watchCollection(tenantID, "logs", this.centralRestServer.notifyLogging.bind(this.centralRestServer), false);
    // Users
    this.watchCollection(tenantID, "users", this.centralRestServer.notifyUser.bind(this.centralRestServer), true);
    // User Images
    this.watchCollection(tenantID, "userimages", this.centralRestServer.notifyUser.bind(this.centralRestServer), true);
    // Charging Stations
    this.watchCollection(tenantID, "chargingstations", this.centralRestServer.notifyChargingStation.bind(this.centralRestServer), true);
    // Vehicle Manufacturers
    this.watchCollection(tenantID, "vehiclemanufacturers", this.centralRestServer.notifyVehicleManufacturer.bind(this.centralRestServer), true);
    // Vehicle Manufacturer Logos
    this.watchCollection(tenantID, "vehiclemanufacturerlogos", this.centralRestServer.notifyVehicleManufacturer.bind(this.centralRestServer), true);
    // Vehicles
    this.watchCollection(tenantID, "vehicles", this.centralRestServer.notifyVehicle.bind(this.centralRestServer), true);
    // Vehicle Images
    this.watchCollection(tenantID, "vehicleimages", this.centralRestServer.notifyVehicle.bind(this.centralRestServer), true);
    // Companies
    this.watchCollection(tenantID, "companies", this.centralRestServer.notifyCompany.bind(this.centralRestServer), true);
    // Company Logos
    this.watchCollection(tenantID, "companylogos", this.centralRestServer.notifyCompany.bind(this.centralRestServer), true);
    // Site Areas
    this.watchCollection(tenantID, "siteareas", this.centralRestServer.notifySiteArea.bind(this.centralRestServer), true);
    // Site Area Images
    this.watchCollection(tenantID, "siteareaimages", this.centralRestServer.notifySiteArea.bind(this.centralRestServer), true);
    // Sites
    this.watchCollection(tenantID, "sites", this.centralRestServer.notifySite.bind(this.centralRestServer), true);
    // Site Images
    this.watchCollection(tenantID, "siteimages", this.centralRestServer.notifySite.bind(this.centralRestServer), true);

    this.watchTransactions(tenantID);
    this.watchMeterValues(tenantID);
    this.watchConfigurations(tenantID);
  }

  async watchCollection(tenantID, name, notifyCallback, notifyWithID){
    // Users
    const collectionWatcher = await this.database.getCollection(tenantID, name).watch(_pipeline, _options);
    // Change Handling
    collectionWatcher.on("change", (change) => {
      if (change.documentKey._id) {
        // Check for permitted operation
        const action = MongoDBStorageNotification.getActionFromOperation(change.operationType);
        // Notify
        if (notifyWithID) {
          notifyCallback(tenantID, action, {
            "id": change.documentKey._id.toString()
          });
        } else {
          notifyCallback(tenantID, action);
        }
      }
    });
    // Error Handling
    collectionWatcher.on("error", (error) => {
      // Log
      Logging.logError({
        module: "MongoDBStorageNotification",
        method: "watchCollection", action: `Watch`,
        message: `Error occurred in watching collection ${name}: ${error}`,
        detailedMessages: error
      });
    });
  }

  async watchTransactions(tenantID){
    // Transaction
    const transactionsWatcher = await this.database.getCollection(tenantID, "transactions").watch(_pipeline, _options);
    // Change Handling
    transactionsWatcher.on("change", (change) => {
      // Check for permitted operation
      const action = MongoDBStorageNotification.getActionFromOperation(change.operationType);
      // Notify
      const notification = {
        "id": change.documentKey._id.toString()
      };
      // Operation
      switch (change.operationType) {
        case 'insert': // Insert/Create
          notification.connectorId = change.fullDocument.connectorId;
          notification.chargeBoxID = change.fullDocument.chargeBoxID;
          break;
        case 'update': // Update
          if (change.fullDocument && change.fullDocument.stop) {
            notification.type = Constants.ENTITY_TRANSACTION_STOP;
          }
          break;
      }
      // Notify
      this.centralRestServer.notifyTransaction(tenantID, action, notification);
    });
  }

  async watchMeterValues(tenantID){
    // Meter Values
    const meterValuesWatcher = await this.database.getCollection(tenantID, "metervalues").watch(_pipeline, _options);
    // Change Handling
    meterValuesWatcher.on("change", (change) => {
      // Check for permitted operation
      const action = MongoDBStorageNotification.getActionFromOperation(change.operationType);
      // Notify
      const notification = {};
      // Insert/Create?
      if (action === Constants.ACTION_CREATE) {
        notification.id = change.fullDocument.transactionId;
        notification.type = Constants.ENTITY_TRANSACTION_METER_VALUES;
        notification.chargeBoxID = change.fullDocument.chargeBoxID;
        notification.connectorId = change.fullDocument.connectorId;
        // Notify, Force Transaction Update
        this.centralRestServer.notifyTransaction(tenantID, Constants.ACTION_UPDATE, notification);
      }
    });
  }

  async watchConfigurations(tenantID){
    // Charging Stations Configuration
    const configurationsWatcher = await this.database.getCollection(tenantID, "configurations").watch(_pipeline, _options);
    // Change Handling
    configurationsWatcher.on("change", (change) => {
      if (change.documentKey._id) {
        // Check for permitted operation
        const action = MongoDBStorageNotification.getActionFromOperation(change.operationType);
        // Notify
        this.centralRestServer.notifyChargingStation(tenantID, action, {
          "type": Constants.NOTIF_TYPE_CHARGING_STATION_CONFIGURATION,
          "id": change.documentKey._id.toString()
        });
      }
    });
  }
}

module.exports = MongoDBStorageNotification;
