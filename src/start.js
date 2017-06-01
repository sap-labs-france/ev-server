var CentralSystemServerFacade = require('./server/CentralSystemServerFacade');
var StorageFacade = require('./storage/StorageFacade');
var Utils = require('./utils/Utils');

// Start the connection to the Database
var database = new StorageFacade(
  Utils.getStoragesConfig());

// Start
database.start().then(() => {
  // Create the server
  var server = new CentralSystemServerFacade(
    Utils.getCentralSystemsConfig(),
    Utils.getCentralSystemRestServiceConfig(),
    Utils.getChargingStationConfig());

  // Start
  server.start();
},
(err) => {
  console.log("Cannot start the Central Service servers: no database is running!");
})
