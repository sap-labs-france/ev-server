const Logging = require('../../../utils/Logging');
const centralSystemService12 = require('./services/centralSystemService1.2');
const centralSystemService12Wsdl = require('./wsdl/OCPP_CentralSystemService1.2.wsdl');
const centralSystemService15 = require('./services/centralSystemService1.5');
const centralSystemService15Wsdl = require('./wsdl/OCPP_CentralSystemService1.5.wsdl');
const centralSystemService16 = require('./services/centralSystemService1.6');
const centralSystemService16Wsdl = require('./wsdl/OCPP_CentralSystemService1.6.wsdl');
const fs = require('fs');
const soap = require('strong-soap').soap;
const http = require('http');
const https = require('https');
const express = require('express')();
const CentralSystemServer = require('../CentralSystemServer');
require('source-map-support').install();

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
		let server;
		// Log
		console.log(`Starting Central System Server (Charging Stations)...`);
		// Make it global for SOAP Services
		global.centralSystemSoap = this;
		// Create the HTTP server
		if (_centralSystemConfig.protocol === "https") {
			// Create the options
			let options = {};
			// Set the keys
			options.key = fs.readFileSync(_centralSystemConfig["ssl-key"]);
			options.cert = fs.readFileSync(_centralSystemConfig["ssl-cert"]);
			// Intermediate cert?
			if (_centralSystemConfig["ssl-ca"]) {
				// Array?
				if (Array.isArray(_centralSystemConfig["ssl-ca"])) {
					options.ca = [];
					// Add all
					for (let i = 0; i < _centralSystemConfig["ssl-ca"].length; i++) {
						options.ca.push(fs.readFileSync(_centralSystemConfig["ssl-ca"][i]));
					}
				} else {
					// Add one
					options.ca = fs.readFileSync(_centralSystemRestConfig["ssl-ca"]);
				}
			}
			// Https server
			server = https.createServer(options, express);
		} else {
			// Http server
			server = http.createServer(express);
		}

		// Create Soap Servers
		// OCPP 1.2 -----------------------------------------
		let soapServer12 = soap.listen(server, '/OCPP12', centralSystemService12, centralSystemService12Wsdl);
		// Log
		if (_centralSystemConfig.debug) {
			// Listen
			soapServer12.log = (type, data) => {
				// Do not log 'Info'
				if (type === 'received' || type === 'replied') {
						// Log
					Logging.logDebug({
						module: "SoapCentralSystemServer", method: "start", action: "SoapRequest",
						message: `OCPP 1.2 - Type '${type}'`,
						detailedMessages: data
					});
				}
			};
		}
		// OCPP 1.5 -----------------------------------------
		let soapServer15 = soap.listen(server, '/OCPP15', centralSystemService15, centralSystemService15Wsdl);
		// Log
		if (_centralSystemConfig.debug) {
			// Listen
			soapServer15.log = (type, data) => {
				// Do not log 'Info'
				if (type === 'received' || type === 'replied') {
					// Log
					Logging.logDebug({
						module: "SoapCentralSystemServer", method: "start", action: "SoapRequest",
						message: `OCPP 1.5 - Type '${type}'`,
						detailedMessages: data
					});
				}
			};
		}
		// OCPP 1.6 -----------------------------------------
		let soapServer16 = soap.listen(server, '/OCPP16', centralSystemService16, centralSystemService16Wsdl);
		// Log
		if (_centralSystemConfig.debug) {
			// Listen
			soapServer16.log = (type, data) => {
				// Do not log 'Info'
				if (type === 'received' || type === 'replied') {
					// Log
					Logging.logDebug({
						module: "SoapCentralSystemServer", method: "start", action: "SoapRequest",
						message: `OCPP 1.6 - Type '${type}'`,
						detailedMessages: data
					});
				}
			};
		}

		// Listen
		server.listen(_centralSystemConfig.port, _centralSystemConfig.host, () => {
				// Log
				Logging.logInfo({
					module: "SoapCentralSystemServer", method: "start", action: "Startup",
					message: `Central System Server (Charging Stations) listening on '${_centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'`
				});
				console.log(`Central System Server (Charging Stations) listening on '${_centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'`);
			});
	}
}

module.exports = SoapCentralSystemServer;
