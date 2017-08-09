const MongoDBStorage = require('./storage/mongodb/MongoDBStorage');
const Configuration = require('./utils/Configuration');
const Utils = require('./utils/Utils');
const SoapCentralSystemServer = require('./server/charging-station/soap/SoapCentralSystemServer');
const CentralRestServer = require('./server/front-end/CentralRestServer');
const Scheduler = require('./scheduler/Scheduler');

require('source-map-support').install();

// Start the connection to the Database
let storageConfig = Configuration.getStorageConfig();

// Check implementation
switch (storageConfig.implementation) {
  // MongoDB?
  case 'mongodb':
    // Create MongoDB
    var mongoDB = new MongoDBStorage(storageConfig);
    // Set global var
    global.storage = mongoDB;
    break;

  default:
    console.log(`Storage Server implementation '${storageConfig.implementation}' not supported!`);
}

// Start the DB
global.storage.start().then(() => {
  // Create the Central Systems (Charging Stations) ------------------
  let centralSystemsConfig = Configuration.getCentralSystemsConfig();
  let chargingStationConfig = Configuration.getChargingStationConfig();
  let advancedConfig = Configuration.getAdvancedConfig();

  // Instanciate central servers
  centralSystemsConfig.forEach((centralSystemConfig) => {
    let centralSystemServer;
    // Check implementation
    switch (centralSystemConfig.implementation) {
      // SOAP
      case 'soap':
        // Create implementation
        centralSystemServer = new SoapCentralSystemServer(centralSystemConfig, chargingStationConfig);
        // Start
        centralSystemServer.start();
        break;

      default:
        console.log(`Central System Server implementation '${centralSystemConfig.implementation}' not found!`);
    }
  });

  // Start the Central Rest System (Front-end REST service)
  // Read the config
  let centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
  // Provided?
  if (centralSystemRestConfig) {
    // Create the server
    let centralRestServer = new CentralRestServer(centralSystemRestConfig);
    // Set to database for Web Socket Notifications
    global.storage.setCentralRestServer(centralRestServer);
    // Start it
    centralRestServer.start();
  }

  // Start the Scheduler
  Scheduler.init();
},
(err) => {
  console.log("Cannot start the Central Server: No Database is running!");
});
