var ChargingStation = require('../../model/ChargingStation');
var centralSystemService12 = require('./services/centralSystemService1.2');
var centralSystemService15 = require('./services/centralSystemService1.5');
var centralSystemService16 = require('./services/centralSystemService1.6');
var ChargingStationRestService = require('../ChargingStationRestService');
var fs = require('fs');
var soap = require('strong-soap').soap;
var path = require('path');
var xmlformatter = require('xml-formatter');
var http = require('http');
var express = require('express')();
var cors = require('cors');
var bodyParser = require("body-parser");
var CentralSystemServer = require('../CentralSystemServer');

require('body-parser-xml')(bodyParser);

let _serverConfig;
let _chargingStationConfig;

class SoapCentralSystemServer extends CentralSystemServer {
    constructor(serverConfig, chargingStationConfig) {
      super(serverConfig, chargingStationConfig);

      // Keep local
      _serverConfig = serverConfig;
      _chargingStationConfig = chargingStationConfig;
    }

    /*
      Start the server and listen to all SOAP OCCP versions
      Listen to external command to send request to charging stations
    */
    start() {
      // Body parser
      express.use(bodyParser.json());
      express.use(bodyParser.urlencoded({ extended: false }));
      express.use(bodyParser.xml());

      // Cross origin headers
      express.use(cors());

      // Receive REST request to trigger action to the charging station remotely (reboot...)
      express.use('/client/api', ChargingStationRestService);

      // Create the HTTP server
      var httpServer = http.createServer(express);

      // Read the WSDL files
      var centralSystemWsdl12 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.2.wsdl'), 'UTF-8');
      var centralSystemWsdl15 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.5.wsdl'), 'UTF-8');
      var centralSystemWsdl16 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.6.wsdl'), 'UTF-8');

      // Create Soap Servers
      // OCPP 1.2 -----------------------------------------
      var soapServer12 = soap.listen(httpServer, '/OCPP12', centralSystemService12, centralSystemWsdl12);
      // Catch Events
      soapServer12.on("request", function(request, methodName) {
        console.log(`Received OCPP 1.2 request:\n${request}\n${methodName}`);
      });
      soapServer12.log = function(type, data) {
        console.log(`OCPP 1.2 Log: ${type}\n${(type === "received"?xmlformatter(data):data)}`);
      };
      // --------------------------------------------------

      // OCPP 1.5 -----------------------------------------
      var soapServer15 = soap.listen(httpServer, '/OCPP15', centralSystemService15, centralSystemWsdl15);
      // Catch Events
      soapServer15.on("request", function(request, methodName) {
        console.log(`Received OCPP 1.5 request:\n${request}\n${methodName}`);
      });
      soapServer15.log = function(type, data) {
        console.log(`OCPP 1.5 Log: ${type}\n${(type === "received"?xmlformatter(data):data)}`);
      };
      // --------------------------------------------------

      // OCPP 1.6 -----------------------------------------
      var soapServer16 = soap.listen(httpServer, '/OCPP16', centralSystemService16, centralSystemWsdl16);
      // Catch Events
      soapServer16.on("request", function(request, methodName) {
        console.log(`Received OCPP 1.6 request:\n${request}\n${methodName}`);
      });
      soapServer16.log = function(type, data) {
        console.log(`OCPP 1.6 Log: ${type}\n${(type === "received"?xmlformatter(data):data)}`);
      };
      // --------------------------------------------------

      // Listen
      httpServer.listen(_serverConfig.port, function(req, res) {
        console.log(`SOAP Server started on port ${_serverConfig.port}`);
      });
    }
}

module.exports = SoapCentralSystemServer;
