const fs = require('fs');
const soap = require('strong-soap').soap;
const http = require('http');
const https = require('https');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const express = require('express')();
const CFLog = require('cf-nodejs-logging-support');
const CentralSystemServer = require('../CentralSystemServer');
const Logging = require('../../../utils/Logging');
const Configuration = require('../../../utils/Configuration');
const centralSystemService12 = require('./services/centralSystemService1.2');
const centralSystemService12Wsdl = require('./wsdl/OCPP_CentralSystemService1.2.wsdl');
const centralSystemService15 = require('./services/centralSystemService1.5');
const centralSystemService15Wsdl = require('./wsdl/OCPP_CentralSystemService1.5.wsdl');
const centralSystemService16 = require('./services/centralSystemService1.6');
const centralSystemService16Wsdl = require('./wsdl/OCPP_CentralSystemService1.6.wsdl');
const chargePointService12Wsdl = require('../../../client/soap/wsdl/OCPP_ChargePointService1.2.wsdl');
const chargePointService15Wsdl = require('../../../client/soap/wsdl/OCPP_ChargePointService1.5.wsdl');
const chargePointService16Wsdl = require('../../../client/soap/wsdl/OCPP_ChargePointService1.6.wsdl');
const sanitize = require('mongo-sanitize');
const bodyParser = require('body-parser');
require('body-parser-xml')(bodyParser);
require('source-map-support').install();

const CentralChargingStationService = require('../CentralChargingStationService');

let _centralSystemConfig;
let _chargingStationConfig;
let _centralChargingStationService;

class SoapCentralSystemServer extends CentralSystemServer {
	constructor(centralSystemConfig, chargingStationConfig) {
		// Call parent
		super(centralSystemConfig, chargingStationConfig);
		
		// Body parser
		express.use(bodyParser.json());
		express.use(bodyParser.urlencoded({ extended: false }));
		express.use(bodyParser.xml());

		// Enable debug?
		if (centralSystemConfig.debug) {
			// Log
			express.use(
				morgan('combined', {
					'stream': {
						write: (message) => { 
							// Log
							Logging.logDebug({
								module: "CentralSystemServer", method: "constructor", action: "HttpRequestLog",
								message: message
							});
						}
					}
				})
			);
			}
		// Cross origin headers
		express.use(cors());

		// Secure the application
		express.use(helmet());

		// Check Cloud Foundry
		if (Configuration.isCloudFoundry()) {
			// Bind to express app
			express.use(CFLog.logNetwork);
		}

		// Keep local
		_centralSystemConfig = centralSystemConfig;
		_chargingStationConfig = chargingStationConfig;

		// Default, serve the index.html
		express.get(/^\/wsdl(.+)$/, function(req, res, next) {
			// WDSL file?
			switch (req.params["0"]) {
				// Charge Point WSDL 1.2
				case '/OCPP_ChargePointService1.2.wsdl':
					res.send(chargePointService12Wsdl);
					break;
				// Charge Point WSDL 1.5
				case '/OCPP_ChargePointService1.5.wsdl':
					res.send(chargePointService15Wsdl);
					break;
				// Charge Point WSDL 1.6
				case '/OCPP_ChargePointService1.6.wsdl':
					res.send(chargePointService16Wsdl);
					break;
				// Unknown
				default:
					res.status(500).send(`${sanitize(req.params["0"])} does not exist!`);
			}
		});


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
				if (type === 'replied') {
					// Log
					Logging.logDebug({
						module: "SoapCentralSystemServer", method: "start", action: "SoapRequest",
						message: `OCPP 1.2 - Request Replied`,
						detailedMessages: data
					});
				}
			};
			// Log Request
			soapServer12.on('request', (request, methodName) => {
				// Log
				Logging.logDebug({
					module: "SoapCentralSystemServer", method: "start", action: "SoapRequest",
					message: `OCPP 1.2 - Request '${methodName}' Received`,
					detailedMessages: request
				});
			});
		}
		// OCPP 1.5 -----------------------------------------
		let soapServer15 = soap.listen(server, '/OCPP15', centralSystemService15, centralSystemService15Wsdl);
		// Log
		if (_centralSystemConfig.debug) {
			// Listen
			soapServer15.log = (type, data) => {
				// Do not log 'Info'
				if (type === 'replied') {
					// Log
					Logging.logDebug({
						module: "SoapCentralSystemServer", method: "start", action: "SoapRequest",
						message: `OCPP 1.5 - Request Replied`,
						detailedMessages: data
					});
				}
			};
			// Log Request
			soapServer15.on('request', (request, methodName) => {
				// Log
				Logging.logDebug({
					module: "SoapCentralSystemServer", method: "start", action: "SoapRequest",
					message: `OCPP 1.5 - Request '${methodName}' Received`,
					detailedMessages: request
				});
			});
	}
		// OCPP 1.6 -----------------------------------------
		let soapServer16 = soap.listen(server, '/OCPP16', centralSystemService16, centralSystemService16Wsdl);
		// Log
		if (_centralSystemConfig.debug) {
			// Listen
			soapServer16.log = (type, data) => {
				// Do not log 'Info'
				if (type === 'replied') {
					// Log
					Logging.logDebug({
						module: "SoapCentralSystemServer", method: "start", action: "SoapRequest",
						message: `OCPP 1.6 - Request Replied`,
						detailedMessages: data
					});
				}
			};
			// Log Request
			soapServer16.on('request', (request, methodName) => {
				// Log
				Logging.logDebug({
					module: "SoapCentralSystemServer", method: "start", action: "SoapRequest",
					message: `OCPP 1.6 - Request '${methodName}' Received`,
					detailedMessages: request
				});
			});
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


	/**
	 * @param protocol: string containing protocol version 1.2 || 1.5 || 1.6
	 * @memberof SoapCentralSystemServer
	 */
	getSoapCentralChargingStationService(protocol){
		switch (protocol) {
			case '1.2':
			case '1.5':
			case '1.6':
			default:
				if (!_centralChargingStationService) {
					_centralChargingStationService = new CentralChargingStationService(_centralSystemConfig, _chargingStationConfig);
        }
				return _centralChargingStationService;
		}
	}
}

module.exports = SoapCentralSystemServer;
