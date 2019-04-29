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
const sanitize = require('express-sanitizer');
require('source-map-support').install();

const MODULE_NAME = "SoapCentralSystemServer";

class SoapCentralSystemServer extends CentralSystemServer {
  constructor(centralSystemConfig, chargingStationConfig) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);

    // Initialize express app
    this._express = expressTools.expressCommonInit();

    // FIXME?: Should be useless now that helmet() is mounted at the beginning
    // Mount express-sanitizer middleware
    this._express.use(sanitize());

    // Enable debug?
    if (this._centralSystemConfig.debug) {
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
  }

  /**
   * Start the server and listen to all SOAP OCCP versions
   * Listen to external command to send request to charging stations
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
      soapServer12.log = (type, data) => { this._handleSoapServerLog('1.2', type, data); };
      // Log Request
      soapServer12.on('request', (request, methodName) => { this._handleSoapServerMessage('1.2', request, methodName); });
    }
    // OCPP 1.5 -----------------------------------------
    const soapServer15 = soap.listen(server, '/OCPP15', centralSystemService15, this.readWsdl('OCPPCentralSystemService15.wsdl'));
    // Log
    if (this._centralSystemConfig.debug) {
      // Listen
      soapServer15.log = (type, data) => { this._handleSoapServerLog('1.5', type, data); };
      // Log Request
      soapServer15.on('request', (request, methodName) => { this._handleSoapServerMessage('1.5', request, methodName); });
    }
    // OCPP 1.6 -----------------------------------------
    const soapServer16 = soap.listen(server, '/OCPP16', centralSystemService16, this.readWsdl('OCPPCentralSystemService16.wsdl'));
    // Log
    if (this._centralSystemConfig.debug) {
      // Listen
      soapServer16.log = (type, data) => { this._handleSoapServerLog('1.6', type, data); };
      // Log Request
      soapServer16.on('request', (request, methodName) => { this._handleSoapServerMessage('1.6', request, methodName); });
    }
  }

  readWsdl(filename) {
    return fs.readFileSync(`${global.appRoot}/assets/server/ocpp/${filename}`, 'utf8');
  }

  _handleSoapServerMessage(ocppVersion, request, methodName) {
    // Log
    Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT, module: MODULE_NAME,
      method: "start", action: "StrongSoapDebug",
      message: `OCPP ${ocppVersion} - Request '${methodName}' Received`,
      detailedMessages: request
    });
  }

  _handleSoapServerLog(ocppVersion, type, data) {
    // Do not log 'Info'
    if (type === 'replied') {
      // Log
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT, module: MODULE_NAME,
        method: "start", action: "StrongSoapDebug",
        message: `OCPP ${ocppVersion} - Request Replied`,
        detailedMessages: data
      });
    }
  }
}

module.exports = SoapCentralSystemServer;
