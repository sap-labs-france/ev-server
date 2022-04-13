import { ServerAction, ServerType } from '../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import Constants from '../../../utils/Constants';
import ExpressUtils from '../../ExpressUtils';
import Logging from '../../../utils/Logging';
import OCPPServer from '../OCPPServer';
import { OCPPVersion } from '../../../types/ocpp/OCPPServer';
import { ServerUtils } from '../../ServerUtils';
import Utils from '../../../utils/Utils';
import centralSystemService15 from './services/SoapCentralSystemService15';
import centralSystemService16 from './services/SoapCentralSystemService16';
import fs from 'fs';
import global from '../../../types/GlobalType';
import http from 'http';
import { soap } from 'strong-soap';

const MODULE_NAME = 'SoapOCPPServer';

export default class SoapOCPPServer extends OCPPServer {
  public httpServer: http.Server;
  private expressApplication: express.Application;

  public constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);
    // Initialize express app
    this.expressApplication = ExpressUtils.initApplication(null, centralSystemConfig.debug);
    // Initialize the HTTP server
    this.httpServer = ServerUtils.createHttpServer(this.centralSystemConfig, this.expressApplication);
  }

  public start(): void {
    // Make it global for SOAP Services
    global.centralSystemSoapServer = this;
    ServerUtils.startHttpServer(this.centralSystemConfig, this.httpServer, MODULE_NAME, ServerType.SOAP_SERVER);
    // Create Soap Servers
    // OCPP 1.5 -----------------------------------------
    const soapServer15 = soap.listen(this.httpServer, `/${Utils.getOCPPServerVersionURLPath(OCPPVersion.VERSION_15)}`,
      centralSystemService15, this.readWsdl('OCPPCentralSystemService15.wsdl'));
    if (this.centralSystemConfig.debug) {
      // Listen
      soapServer15.log = async (type, data) => {
        await this.handleSoapServerLog(OCPPVersion.VERSION_15, type, data);
      };
      // Log Request
      soapServer15.on('request', async (request, methodName) => {
        await this.handleSoapServerMessage(OCPPVersion.VERSION_15, request, methodName);
      });
    }
    // OCPP 1.6 -----------------------------------------
    const soapServer16 = soap.listen(this.httpServer, `/${Utils.getOCPPServerVersionURLPath(OCPPVersion.VERSION_16)}`,
      centralSystemService16, this.readWsdl('OCPPCentralSystemService16.wsdl'));
    if (this.centralSystemConfig.debug) {
      // Listen
      soapServer16.log = async (type, data) => {
        await this.handleSoapServerLog(OCPPVersion.VERSION_16, type, data);
      };
      // Log Request
      soapServer16.on('request', async (request, methodName) => {
        await this.handleSoapServerMessage(OCPPVersion.VERSION_16, request, methodName);
      });
    }
    // Post init
    ExpressUtils.postInitApplication(this.expressApplication);
  }

  private readWsdl(filename: string): string {
    return fs.readFileSync(`${global.appRoot}/assets/server/ocpp/wsdl/${filename}`, 'utf8');
  }

  private async handleSoapServerMessage(ocppVersion: OCPPVersion, request: any, methodName: string) {
    await Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT_ID, module: MODULE_NAME,
      method: 'handleSoapServerMessage',
      action: ServerAction.EXPRESS_SERVER,
      message: `>> OCPP ${ocppVersion} Request '${methodName}' Received`,
      detailedMessages: { request }
    });
  }

  private async handleSoapServerLog(ocppVersion: OCPPVersion, type: string, data: any) {
    // Do not log 'Info'
    if (type === 'replied') {
      await Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT_ID, module: MODULE_NAME,
        method: 'handleSoapServerLog',
        action: ServerAction.EXPRESS_SERVER,
        message: `<< OCPP ${ocppVersion} Request Sent`,
        detailedMessages: { data }
      });
    }
  }
}

