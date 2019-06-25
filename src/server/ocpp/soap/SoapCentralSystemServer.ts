import fs from 'fs';
import { soap } from 'strong-soap';
import morgan from 'morgan';
import express from 'express';
import expressTools from '../../ExpressTools';
import CentralSystemServer from '../CentralSystemServer';
import Logging from '../../../utils/Logging';
import Constants from '../../../utils/Constants';
import centralSystemService12 from './services/SoapCentralSystemService12';
import centralSystemService15 from './services/SoapCentralSystemService15';
import centralSystemService16 from './services/SoapCentralSystemService16';
import sanitize from 'express-sanitizer';
import SourceMap from 'source-map-support';
SourceMap.install();
import TSGlobal from '../../../types/GlobalType';
declare const global: TSGlobal;

const MODULE_NAME = "SoapCentralSystemServer";
export default class SoapCentralSystemServer extends CentralSystemServer {

  private express: express.Application;

  constructor(centralSystemConfig, chargingStationConfig) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);

    // Initialize express app
    this.express = expressTools.init();

    // Mount express-sanitizer middleware
    this.express.use(sanitize());

    // Enable debug?
    if (this.centralSystemConfig.debug) {
      // Log
      this.express.use(
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
   * Start the server and listen to all SOAP OCPP versions
   * Listen to external command to send request to charging stations
   */
  start() {
    // Make it global for SOAP Services
    global.centralSystemSoap = this;

    const httpServer = expressTools.createHttpServer(this.centralSystemConfig, this.express);
    expressTools.startServer(this.centralSystemConfig, httpServer, "OCPP Soap", MODULE_NAME);

    // Create Soap Servers
    // OCPP 1.2 -----------------------------------------
    const soapServer12 = soap.listen(httpServer, '/OCPP12', centralSystemService12, this.readWsdl('OCPPCentralSystemService12.wsdl'));
    // Log
    if (this.centralSystemConfig.debug) {
      // Listen
      soapServer12.log = (type, data) => {
        this._handleSoapServerLog('1.2', type, data);
      };
      // Log Request
      soapServer12.on('request', (request, methodName) => {
        this._handleSoapServerMessage('1.2', request, methodName);
      });
    }
    // OCPP 1.5 -----------------------------------------
    const soapServer15 = soap.listen(httpServer, '/OCPP15', centralSystemService15, this.readWsdl('OCPPCentralSystemService15.wsdl'));
    // Log
    if (this.centralSystemConfig.debug) {
      // Listen
      soapServer15.log = (type, data) => {
        this._handleSoapServerLog('1.5', type, data);
      };
      // Log Request
      soapServer15.on('request', (request, methodName) => {
        this._handleSoapServerMessage('1.5', request, methodName);
      });
    }
    // OCPP 1.6 -----------------------------------------
    const soapServer16 = soap.listen(httpServer, '/OCPP16', centralSystemService16, this.readWsdl('OCPPCentralSystemService16.wsdl'));
    // Log
    if (this.centralSystemConfig.debug) {
      // Listen
      soapServer16.log = (type, data) => {
        this._handleSoapServerLog('1.6', type, data);
      };
      // Log Request
      soapServer16.on('request', (request, methodName) => {
        this._handleSoapServerMessage('1.6', request, methodName);
      });
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

