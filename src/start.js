var CentralServerFacade = require('./server/CentralServerFacade');
var StorageFacade = require('./storage/StorageFacade');
var Utils = require('./utils/Utils');

// Start the connection to the Database
var database = new StorageFacade(
  Utils.getStoragesConfig());

// Start
database.start().then(() => {
  // Create the server
  var server = new CentralServerFacade(
    Utils.getCentralSystemsConfig(),
    Utils.getCentralSystemRestServiceConfig(),
    Utils.getChargingStationConfig());

  // Start
  server.start();
},
(err) => {
  console.log("Cannot start the Central Server: No Database is running!");
})
