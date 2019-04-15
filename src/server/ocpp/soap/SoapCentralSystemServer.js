const fs = require('fs');
const soap = require('strong-soap').soap;
const morgan = require('morgan');
const expressTools = require('../../ExpressTools');
const CentralSystemServer = require('../CentralSystemServer');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const centralSystemService12 = require('./services/SoapCentralSystemService12');
const centralSystemService15 = require('./services/SoapCentralSystemService15');
const centralSystemService16 = require('./services/SoapCentralSystemService16');
const chargePointService12Wsdl = require('../../../client/soap/wsdl/OCPPChargePointService12.wsdl');
const chargePointService15Wsdl = require('../../../client/soap/wsdl/OCPPChargePointService15.wsdl');
const chargePointService16Wsdl = require('../../../client/soap/wsdl/OCPPChargePointService16.wsdl');
const sanitize = require('express-sanitizer');
require('source-map-support').install();

const MODULE_NAME = "SoapCentralSystemServer";

class SoapCentralSystemServer extends CentralSystemServer {
  constructor(centralSystemConfig, chargingStationConfig) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);

    // Initialize express app
    this._express = expressTools.expressCommonInit()

    // FIXME?: Should be useless now that helmet() is mounted at the beginning
    // Mount express-sanitizer middleware
    this._express.use(sanitize());

    // Enable debug?
    if (centralSystemConfig.debug) {
      // Log
      this._express.use(
        morgan('combined', {
          'stream': {
            write: (message) => {
              // Log
              Logging.logDebug({
                tenantID: Constants.DEFAULT_TENANT,
                module: MODULE_NAME, method: "constructor",
                action: "HttpRequestLog",
                message: message
              });
            }
          }
        })
      );
    }
    // Default, serve the index.html
    // eslint-disable-next-line no-unused-vars
    this._express.get(/^\/wsdl(.+)$/, function (req, res, next) {
      // WDSL file?
      switch (req.params["0"]) {
        // Charge Point WSDL 1.2
        case '/OCPPChargePointService12.wsdl':
          res.send(chargePointService12Wsdl);
          break;
        // Charge Point WSDL 1.5
        case '/OCPPChargePointService15.wsdl':
          res.send(chargePointService15Wsdl);
          break;
        // Charge Point WSDL 1.6
        case '/OCPPChargePointService16.wsdl':
          res.send(chargePointService16Wsdl);
          break;
        // Unknown
        default:
          res.status(500).send(`${req.sanitize(req.params["0"])} does not exist!`);
      }
    });
  }

  /*
  	Start the server and listen to all SOAP OCCP versions
  	Listen to external command to send request to charging stations
  */
  start() {
    // Make it global for SOAP Services
    global.centralSystemSoap = this;

    const server = expressTools.expressStartServer(this._centralSystemConfig, "OCPP Soap", MODULE_NAME, this._express);

    // Create Soap Servers
    // OCPP 1.2 -----------------------------------------
    const soapServer12 = soap.listen(server, '/OCPP12', centralSystemService12, this.readWsdl('OCPPCentralSystemService12.wsdl'));
    // Log
    if (this._centralSystemConfig.debug) {
      // Listen
      soapServer12.log = (type, data) => {
        // Do not log 'Info'
        if (type === 'replied') {
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME,
            method: "start", action: "SoapRequest",
            message: `OCPP 1.2 - Request Replied`,
            detailedMessages: data
          });
        }
      };
      // Log Request
      soapServer12.on('request', (request, methodName) => {
        // Log
        Logging.logDebug({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME,
          method: "start", action: "SoapRequest",
          message: `OCPP 1.2 - Request '${methodName}' Received`,
          detailedMessages: request
        });
      });
    }
    // OCPP 1.5 -----------------------------------------
    const soapServer15 = soap.listen(server, '/OCPP15', centralSystemService15, this.readWsdl('OCPPCentralSystemService15.wsdl'));
    // Log
    if (this._centralSystemConfig.debug) {
      // Listen
      soapServer15.log = (type, data) => {
        // Do not log 'Info'
        if (type === 'replied') {
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME,
            method: "start", action: "SoapRequest",
            message: `OCPP 1.5 - Request Replied`,
            detailedMessages: data
          });
        }
      };
      // Log Request
      soapServer15.on('request', (request, methodName) => {
        // Log
        Logging.logDebug({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME,
          method: "start", action: "SoapRequest",
          message: `OCPP 1.5 - Request '${methodName}' Received`,
          detailedMessages: request
        });
      });
    }
    // OCPP 1.6 -----------------------------------------
    const soapServer16 = soap.listen(server, '/OCPP16', centralSystemService16, this.readWsdl('OCPPCentralSystemService16.wsdl'));
    // Log
    if (this._centralSystemConfig.debug) {
      // Listen
      soapServer16.log = (type, data) => {
        // Do not log 'Info'
        if (type === 'replied') {
          // Log
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            module: MODULE_NAME,
            method: "start", action: "SoapRequest",
            message: `OCPP 1.6 - Request Replied`,
            detailedMessages: data
          });
        }
      };
      // Log Request
      soapServer16.on('request', (request, methodName) => {
        // Log
        Logging.logDebug({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: "start",
          action: "SoapRequest",
          message: `OCPP 1.6 - Request '${methodName}' Received`,
          detailedMessages: request
        });
      });
    }
  }

  readWsdl(filename) {
    return fs.readFileSync(`${global.appRoot}/assets/server/ocpp/${filename}`, 'utf8');
  }
}

module.exports = SoapCentralSystemServer;
