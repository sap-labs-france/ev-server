var SoapCentralSystemServer = require('./charging-station/soap/SoapCentralSystemServer');
var CentralServerRestServer = require('./front-end/CentralServerRestServer');
var CentralServerBackgroundTasks = require('./CentralServerBackgroundTasks');

let _centralSystemsConfig;
let _centralSystemRestConfig;
let _centralSystemServers = [];
let _centralServerRestServer;

class CentralServerFacade {
  // Build Central System Servers
  constructor(centralSystemsConfig, centralSystemRestConfig, chargingStationConfig) {
    // Read conf
    _centralSystemsConfig = centralSystemsConfig;
    _centralSystemRestConfig = centralSystemRestConfig;

    // Instanciate central servers
    _centralSystemsConfig.forEach(function(centralServerConfig) {
      // Check implementation
      switch (centralServerConfig.implementation) {
        // SOAP
        case 'soap':
          // Create implementation
          var soapCentralSystemServer = new SoapCentralSystemServer(centralServerConfig, chargingStationConfig);
          // Add
          _centralSystemServers.push(soapCentralSystemServer);
          break;
        default:
          console.log('Central System Server implementation not found!');
      }
    });

    // Instantiate the Rest Server
    _centralServerRestServer = new CentralServerRestServer(centralSystemRestConfig);
  }

  // Start the server
  start() {
    // Start all the Central Service Servers
    _centralSystemServers.forEach(function(centralSystemServer) {
      centralSystemServer.start();
    });

    // Start the Central Service Rest server
    _centralServerRestServer.start();

    // Check the charging station status...
    setInterval(CentralServerBackgroundTasks.executeAllBackgroundTasks, 15 * 1000);
  }
}

module.exports = CentralServerFacade;
