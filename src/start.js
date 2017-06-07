var CentralServerFacade = require('./server/CentralServerFacade');
var StorageFacade = require('./storage/StorageFacade');
var Configuration = require('./utils/Configuration');

// Start the connection to the Database
var database = new StorageFacade(
  Configuration.getStoragesConfig());

// Start
database.start().then(() => {
  // Create the server
  var server = new CentralServerFacade(
    Configuration.getCentralSystemsConfig(),
    Configuration.getCentralSystemRestServiceConfig(),
    Configuration.getChargingStationConfig());

  // Start
  server.start();
},
(err) => {
  console.log("Cannot start the Central Server: No Database is running!");
})
