import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import CentralSystemServer from '../CentralSystemServer';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import centralSystemService12 from './services/SoapCentralSystemService12';
import centralSystemService15 from './services/SoapCentralSystemService15';
import centralSystemService16 from './services/SoapCentralSystemService16';
import express from 'express';
import expressTools from '../../ExpressTools';
import fs from 'fs';
import global from '../../../types/GlobalType';
import http from 'http';
import morgan from 'morgan';
import sanitize from 'express-sanitizer';
import { soap } from 'strong-soap';

const MODULE_NAME = 'SoapCentralSystemServer';

export default class SoapCentralSystemServer extends CentralSystemServer {
  public httpServer: http.Server;
  private expressApplication: express.Application;

  constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);

    // Initialize express app
    this.expressApplication = expressTools.initApplication();

    // Initialize the HTTP server
    this.httpServer = expressTools.createHttpServer(this.centralSystemConfig, this.expressApplication);

    // Mount express-sanitizer middleware
    this.expressApplication.use(sanitize());

    // Enable debug?
    if (this.centralSystemConfig.debug) {
      // Log
      this.expressApplication.use(
        morgan('combined', {
          'stream': {
            write: (message) => {
              // Log
              Logging.logDebug({
                tenantID: Constants.DEFAULT_TENANT,
                module: MODULE_NAME, method: 'constructor',
                action: ServerAction.EXPRESS_SERVER,
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
    global.centralSystemSoapServer = this;

    expressTools.startServer(this.centralSystemConfig, this.httpServer, 'OCPP Soap', MODULE_NAME);

    // Create Soap Servers
    // OCPP 1.2 -----------------------------------------
    const soapServer12 = soap.listen(this.httpServer, '/OCPP12', centralSystemService12, this.readWsdl('OCPPCentralSystemService12.wsdl'));
    // Log
    if (this.centralSystemConfig.debug) {
      // Listen
      soapServer12.log = (type, data) => {
        this.handleSoapServerLog('1.2', type, data);
      };
      // Log Request
      soapServer12.on('request', (request, methodName) => {
        this.handleSoapServerMessage('1.2', request, methodName);
      });
    }
    // OCPP 1.5 -----------------------------------------
    const soapServer15 = soap.listen(this.httpServer, '/OCPP15', centralSystemService15, this.readWsdl('OCPPCentralSystemService15.wsdl'));

    // Log
    if (this.centralSystemConfig.debug) {
      // Listen
      soapServer15.log = (type, data) => {
        this.handleSoapServerLog('1.5', type, data);
      };
      // Log Request
      soapServer15.on('request', (request, methodName) => {
        this.handleSoapServerMessage('1.5', request, methodName);
      });
    }
    // OCPP 1.6 -----------------------------------------
    const soapServer16 = soap.listen(this.httpServer, '/OCPP16', centralSystemService16, this.readWsdl('OCPPCentralSystemService16.wsdl'));
    // Log
    if (this.centralSystemConfig.debug) {
      // Listen
      soapServer16.log = (type, data) => {
        this.handleSoapServerLog('1.6', type, data);
      };
      // Log Request
      soapServer16.on('request', (request, methodName) => {
        this.handleSoapServerMessage('1.6', request, methodName);
      });
    }
  }

  readWsdl(filename) {
    return fs.readFileSync(`${global.appRoot}/assets/server/ocpp/wsdl/${filename}`, 'utf8');
  }

  private handleSoapServerMessage(ocppVersion, request, methodName) {
    // Log
    Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT, module: MODULE_NAME,
      method: 'handleSoapServerMessage',
      action: ServerAction.EXPRESS_SERVER,
      message: `>> OCPP ${ocppVersion} - Request '${methodName}' Received`,
      detailedMessages: { request }
    });
  }

  private handleSoapServerLog(ocppVersion, type, data) {
    // Do not log 'Info'
    if (type === 'replied') {
      // Log
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT, module: MODULE_NAME,
        method: 'handleSoapServerLog',
        action: ServerAction.EXPRESS_SERVER,
        message: `<< OCPP ${ocppVersion} - Request Replied`,
        detailedMessages: { data }
      });
    }
  }
}

