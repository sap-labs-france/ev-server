var Logging = require('../../../utils/Logging');
var centralSystemService12 = require('./services/centralSystemService1.2');
var centralSystemService15 = require('./services/centralSystemService1.5');
var centralSystemService16 = require('./services/centralSystemService1.6');
var fs = require('fs');
var soap = require('strong-soap').soap;
var path = require('path');
var http = require('http');
var https = require('https');
var express = require('express')();
var CentralSystemServer = require('../CentralSystemServer');
var fs = require('fs');

let _centralSystemConfig;
let _chargingStationConfig;

class SoapCentralSystemServer extends CentralSystemServer {
    constructor(centralSystemConfig, chargingStationConfig) {
      // Call parent
      super(centralSystemConfig, chargingStationConfig, express);

      // Keep local
      _centralSystemConfig = centralSystemConfig;
      _chargingStationConfig = chargingStationConfig;
    }

    /*
      Start the server and listen to all SOAP OCCP versions
      Listen to external command to send request to charging stations
    */
    start() {
      // Create the server
      var server;

      // Make it global for SOAP Services
      global.centralSystemSoap = this;

      // Create the HTTP server
      if (_centralSystemConfig.protocol === "https") {
        // Create the options
        const options = {
          key: fs.readFileSync(_centralSystemConfig["ssl-key"]),
          cert: fs.readFileSync(_centralSystemConfig["ssl-cert"])
        };
        // Https server
        server = https.createServer(options, express);
      } else {
        // Http server
        server = http.createServer(express);
      }

      // Read the WSDL files
      var centralSystemWsdl12 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.2.wsdl'), 'UTF-8');
      var centralSystemWsdl15 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.5.wsdl'), 'UTF-8');
      var centralSystemWsdl16 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.6.wsdl'), 'UTF-8');

      // Create Soap Servers
      // OCPP 1.2 -----------------------------------------
      var soapServer12 = soap.listen(server, '/OCPP12', centralSystemService12, centralSystemWsdl12);
      // OCPP 1.5 -----------------------------------------
      var soapServer15 = soap.listen(server, '/OCPP15', centralSystemService15, centralSystemWsdl15);
      // OCPP 1.6 -----------------------------------------
      var soapServer16 = soap.listen(server, '/OCPP16', centralSystemService16, centralSystemWsdl16);

      // Listen
      server.listen(_centralSystemConfig.port, _centralSystemConfig.host, () => {
        // Log
        Logging.logInfo({
          userFullName: "System", source: "Central Server", module: "SoapCentralSystemServer", method: "start", action: "Startup",
          message: `Central System Server (Charging Stations) started on '${_centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'` });
        console.log(`Central System Server (Charging Stations) started on '${_centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'`);
      });
    }
}

module.exports = SoapCentralSystemServer;
