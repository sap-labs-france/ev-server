import { OCPP15MeterValuesRequest, OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse, OCPPVersion } from '../../../../src/types/ocpp/OCPPServer';

import ChargingStation from '../../../types/ChargingStation';
import OCPPService from '../OCPPService';
import global from '../../../../src/types/GlobalType';
import soap from 'strong-soap';

export default class OCPPSoapService15 extends OCPPService {
  public client: any;
  public service: any;
  public constructor(serverUrl: string) {
    super(serverUrl);
    // Init
    this.client = null;
  }

  public getVersion(): OCPPVersion {
    return OCPPVersion.VERSION_15;
  }

  public async executeAuthorize(chargingStation: ChargingStation, authorize: OCPPAuthorizeRequest): Promise<OCPPAuthorizeResponse> {
    return this.execute(this.buildSOAPRequest(chargingStation, 'Authorize', authorize));
  }

  public async executeStartTransaction(chargingStation: ChargingStation, startTransaction: OCPPStartTransactionRequest): Promise<OCPPStartTransactionResponse> {
    return this.execute(this.buildSOAPRequest(chargingStation, 'StartTransaction', startTransaction));
  }

  public async executeStopTransaction(chargingStation: ChargingStation, stopTransaction: OCPPStopTransactionRequest): Promise<OCPPStopTransactionResponse> {
    return await this.execute(this.buildSOAPRequest(chargingStation, 'StopTransaction', stopTransaction));
  }

  public async executeHeartbeat(chargingStation: ChargingStation, heartbeat: OCPPHeartbeatRequest): Promise<OCPPHeartbeatResponse> {
    return await this.execute(this.buildSOAPRequest(chargingStation, 'Heartbeat', heartbeat));
  }

  public async executeMeterValues(chargingStation: ChargingStation, meterValue: OCPPMeterValuesRequest|OCPP15MeterValuesRequest): Promise<OCPPMeterValuesResponse> {
    return await this.execute(this.buildSOAPRequest(chargingStation, 'MeterValues', meterValue));
  }

  public async executeBootNotification(chargingStation: ChargingStation, bootNotification: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse> {
    return await this.execute(this.buildSOAPRequest(chargingStation, 'BootNotification', bootNotification));
  }

  public async executeStatusNotification(chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequest): Promise<OCPPStatusNotificationResponse> {
    return await this.execute(this.buildSOAPRequest(chargingStation, 'StatusNotification', statusNotification));
  }

  public async executeFirmwareStatusNotification(chargingStation: ChargingStation, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequest): Promise<OCPPFirmwareStatusNotificationResponse> {
    return await this.execute(this.buildSOAPRequest(chargingStation, 'FirmwareStatusNotification', firmwareStatusNotification));
  }

  public async executeDiagnosticsStatusNotification(chargingStation: ChargingStation, diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequest): Promise<OCPPDiagnosticsStatusNotificationResponse> {
    return await this.execute(this.buildSOAPRequest(chargingStation, 'DiagnosticsStatusNotification', diagnosticsStatusNotification));
  }

  public async executeDataTransfer(chargingStation: ChargingStation, dataTransfer: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse> {
    return await this.execute(this.buildSOAPRequest(chargingStation, 'DataTransfer', dataTransfer));
  }

  private async execute(request: any): Promise<any> {
    // Init Client (Done only once)
    await this.initSOAPClient();
    // Init SOAP header
    this.client.clearSoapHeaders();
    this.client.addSoapHeader(request.headers);
    // Build the SOAP Request
    const payload = {};
    payload[this.getRequestNameFromAction(request.name)] = request.data;
    // Execute it
    const { result } = await this.service[request.name](payload);
    return result || {};
  }

  private buildSOAPRequest(chargingStation: ChargingStation, action: string, payload: any): any {
    return {
      name: action,
      headers: {
        chargeBoxIdentity: chargingStation.id,
        From: {
          Address: 'http://www.w3.org/2005/08/addressing/anonymous'
        },
        To: this.serverUrl,
        ReplyTo: {
          'Address': 'http://www.w3.org/2005/08/addressing/anonymous'
        }
      },
      data: payload
    };
  }

  private getRequestNameFromAction(actionName: string): string {
    return actionName.replace(/^\w/, (c) => c.toLowerCase()).concat('Request');
  }

  private async initSOAPClient() {
    // Client options
    const options = {};
    // Check
    if (!this.client) {
      // Create the Promise
      this.client = await new Promise(function(resolve, reject) {
        // Create the client
        soap.soap.createClient(`${global.appRoot}/assets/server/ocpp/wsdl/OCPPCentralSystemService15.wsdl`, options, (err, client) => {
          if (err) {
            reject(err);
          } else {
            resolve(client);
          }
        });
      });
      // Set endpoint
      this.client.setEndpoint(this.serverUrl);
      // Reference the Services (Authorize, StartTransaction...)
      this.service = this.client['CentralSystemService']['CentralSystemServiceSoap12'];
    }
  }
}
