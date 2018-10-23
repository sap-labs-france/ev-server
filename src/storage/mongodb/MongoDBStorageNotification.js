const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');

require('source-map-support').install();

let _dbConfig;
let _centralRestServer;
let _evseDB;

class MongoDBStorageNotification {
  // Create database access
  constructor(dbConfig, evseDB){
    // Keep local
    _dbConfig = dbConfig;
    _evseDB = evseDB;
  }

  setCentralRestServer(centralRestServer){
    // Keep Central Server
    _centralRestServer = centralRestServer;
  }

  // Check for permitted operation
  getActionFromOperation(operation){
    // Check
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
    // Log
    console.log(`Starting to monitor changes on database '${_dbConfig.implementation}'...`);
    // Start Listening
    this.checkChangedCollections();
    // Log
    Logging.logInfo({
      module: "MongoDBStorage", method: "start", action: "Startup",
      message: `Monitor changes on database '${_dbConfig.implementation}' is active`
    });
    console.log(`Monitor changes on database '${_dbConfig.implementation}' is active`);
  }

  async watchCollection(name, pipeline, options, notifyCallback, notifyWithID){
    // Users
    const collectionWatcher = await _evseDB.collection(name).watch(pipeline, options);
    // Change Handling
    collectionWatcher.on("change", (change) => {
      // Check for permitted operation
      const action = this.getActionFromOperation(change.operationType);
      // Notify
      if (notifyWithID) {
        notifyCallback(action, {
          "id": change.documentKey._id.toString()
        });
      } else {
        notifyCallback(action);
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

  async checkChangedCollections(){
    let action, notification;
    const pipeline = [];
    const options = {
      'fullDocument': 'updateLookup'
    };
    // Check
    if (!_centralRestServer) {
      return;
    }

    // Logs
    this.watchCollection("logs", pipeline, options, _centralRestServer.notifyLogging.bind(_centralRestServer), false);
    // Users
    this.watchCollection("users", pipeline, options, _centralRestServer.notifyUser.bind(_centralRestServer), true);
    // Tenants
    this.watchCollection("tenants", pipeline, options, _centralRestServer.notifyTenant.bind(_centralRestServer), true);
    // User Images
    this.watchCollection("userimages", pipeline, options, _centralRestServer.notifyUser.bind(_centralRestServer), true);
    // Charging Stations
    this.watchCollection("chargingstations", pipeline, options, _centralRestServer.notifyChargingStation.bind(_centralRestServer), true);
    // Vehicle Manufacturers
    this.watchCollection("vehiclemanufacturers", pipeline, options, _centralRestServer.notifyVehicleManufacturer.bind(_centralRestServer), true);
    // Vehicle Manufacturer Logos
    this.watchCollection("vehiclemanufacturerlogos", pipeline, options, _centralRestServer.notifyVehicleManufacturer.bind(_centralRestServer), true);
    // Vehicles
    this.watchCollection("vehicles", pipeline, options, _centralRestServer.notifyVehicle.bind(_centralRestServer), true);
    // Vehicle Images
    this.watchCollection("vehicleimages", pipeline, options, _centralRestServer.notifyVehicle.bind(_centralRestServer), true);
    // Companies
    this.watchCollection("companies", pipeline, options, _centralRestServer.notifyCompany.bind(_centralRestServer), true);
    // Company Logos
    this.watchCollection("companylogos", pipeline, options, _centralRestServer.notifyCompany.bind(_centralRestServer), true);
    // Site Areas
    this.watchCollection("siteareas", pipeline, options, _centralRestServer.notifySiteArea.bind(_centralRestServer), true);
    // Site Area Images
    this.watchCollection("siteareaimages", pipeline, options, _centralRestServer.notifySiteArea.bind(_centralRestServer), true);
    // Sites
    this.watchCollection("sites", pipeline, options, _centralRestServer.notifySite.bind(_centralRestServer), true);
    // Site Images
    this.watchCollection("siteimages", pipeline, options, _centralRestServer.notifySite.bind(_centralRestServer), true);
    // Transaction
    const transactionsWatcher = await _evseDB.collection("transactions").watch(pipeline, options);
    // Change Handling
    transactionsWatcher.on("change", (change) => {
      // Check for permitted operation
      const action = this.getActionFromOperation(change.operationType);
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
          if (change.fullDocument.stop) {
            notification.type = Constants.ENTITY_TRANSACTION_STOP;
          }
          break;
      }
      // Notify
      _centralRestServer.notifyTransaction(action, notification);
    });

    // Meter Values
    const meterValuesWatcher = await _evseDB.collection("metervalues").watch(pipeline, options);
    // Change Handling
    meterValuesWatcher.on("change", (change) => {
      // Check for permitted operation
      const action = this.getActionFromOperation(change.operationType);
      // Notify
      const notification = {};
      // Insert/Create?
      if (change.operationType == 'insert') {
        notification.id = change.fullDocument.transactionId;
        notification.type = Constants.ENTITY_TRANSACTION_METER_VALUES;
        notification.chargeBoxID = change.fullDocument.chargeBoxID;
        notification.connectorId = change.fullDocument.connectorId;
        // Notify, Force Transaction Update
        _centralRestServer.notifyTransaction(Constants.ACTION_UPDATE, notification);
      }
    });

    // Charging Stations Configuration
    const configurationsWatcher = await _evseDB.collection("configurations").watch(pipeline, options);
    // Change Handling
    configurationsWatcher.on("change", (change) => {
      // Check for permitted operation
      const action = this.getActionFromOperation(change.operationType);
      // Notify
      _centralRestServer.notifyChargingStation(action, {
        "type": Constants.NOTIF_TYPE_CHARGING_STATION_CONFIGURATION,
        "id": change.documentKey._id.toString()
      });
    });
  }
}

module.exports = MongoDBStorageNotification;
