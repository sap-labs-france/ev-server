var SoapCentralSystemServer = require('./soap/SoapCentralSystemServer');
var StorageFacade = require('../storage/StorageFacade');

let _serversConfig;
let _centralSystems = [];

class CentralSystemServerFacade {
  constructor(serversConfig, chargingStationConfig) {
    // Read conf
    _serversConfig = serversConfig;

    // Instanciate central servers
    _serversConfig.forEach(function(centralServerConfig) {
      // Check implementation
      switch (centralServerConfig.implementation) {
        // SOAP 
        case 'soap':
          // Create implementation
          var soapCentralSystemServer = new SoapCentralSystemServer(centralServerConfig, chargingStationConfig);
          // Add
          _centralSystems.push(soapCentralSystemServer);
          // Make it global for SOAP Services
          global.centralSystemSoap = soapCentralSystemServer;
          break;
        default:
          console.log('Central System Server implementation not found!');
      }
    });
  }

  // Start the server
  start() {
    // Create the storage
    global.storage = new StorageFacade();

    // Start the Servers
    _centralSystems.forEach(function(centralSystem) {
      centralSystem.start();
    });
  }
}

module.exports = CentralSystemServerFacade;
