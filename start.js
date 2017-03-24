var CentralSystemServerFacade = require('./server/CentralSystemServerFacade');
var Utils = require('./utils/Utils');

// Create the server
var server = new CentralSystemServerFacade(Utils.getCentralSystemsConfig(), Utils.getChargingStationConfig());

// Start
server.start();
