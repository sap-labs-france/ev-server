var SoapCentralSystemServer = require('./soap/SoapCentralSystemServer');
var CentralSystemRestServer = require('./CentralSystemRestServer');

let _centralSystemsConfig;
let _centralSystemRestConfig;
let _centralSystemServers = [];
let _centralSystemRestServer;

class CentralSystemServerFacade {
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
    _centralSystemRestServer = new CentralSystemRestServer(centralSystemRestConfig);
  }

  // Start the server
  start() {
    // Start all the Central Service Servers
    _centralSystemServers.forEach(function(centralSystemServer) {
      centralSystemServer.start();
    });

    // Start the Central Service Rest server
    _centralSystemRestServer.start();
  }
}

module.exports = CentralSystemServerFacade;
