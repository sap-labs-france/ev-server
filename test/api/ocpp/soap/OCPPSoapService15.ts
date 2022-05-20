import { OCPP15MeterValuesRequest, OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse, OCPPVersion } from '../../../../src/types/ocpp/OCPPServer';

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

  public async executeAuthorize(chargingStationID: string, authorize: OCPPAuthorizeRequest): Promise<OCPPAuthorizeResponse> {
    return this.execute(this.buildSOAPRequest(chargingStationID, 'Authorize', authorize));
  }

  public async executeStartTransaction(chargingStationID: string, startTransaction: OCPPStartTransactionRequest): Promise<OCPPStartTransactionResponse> {
    return this.execute(this.buildSOAPRequest(chargingStationID, 'StartTransaction', startTransaction));
  }

  public async executeStopTransaction(chargingStationID: string, stopTransaction: OCPPStopTransactionRequest): Promise<OCPPStopTransactionResponse> {
    return this.execute(this.buildSOAPRequest(chargingStationID, 'StopTransaction', stopTransaction));
  }

  public async executeHeartbeat(chargingStationID: string, heartbeat: OCPPHeartbeatRequest): Promise<OCPPHeartbeatResponse> {
    return this.execute(this.buildSOAPRequest(chargingStationID, 'Heartbeat', heartbeat));
  }

  public async executeMeterValues(chargingStationID: string, meterValue: OCPPMeterValuesRequest|OCPP15MeterValuesRequest): Promise<OCPPMeterValuesResponse> {
    return this.execute(this.buildSOAPRequest(chargingStationID, 'MeterValues', meterValue));
  }

  public async executeBootNotification(chargingStationID: string, bootNotification: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse> {
    return this.execute(this.buildSOAPRequest(chargingStationID, 'BootNotification', bootNotification));
  }

  public async executeStatusNotification(chargingStationID: string, statusNotification: OCPPStatusNotificationRequest): Promise<OCPPStatusNotificationResponse> {
    return this.execute(this.buildSOAPRequest(chargingStationID, 'StatusNotification', statusNotification));
  }

  public async executeFirmwareStatusNotification(chargingStationID: string, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequest): Promise<OCPPFirmwareStatusNotificationResponse> {
    return this.execute(this.buildSOAPRequest(chargingStationID, 'FirmwareStatusNotification', firmwareStatusNotification));
  }

  public async executeDiagnosticsStatusNotification(chargingStationID: string, diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequest): Promise<OCPPDiagnosticsStatusNotificationResponse> {
    return this.execute(this.buildSOAPRequest(chargingStationID, 'DiagnosticsStatusNotification', diagnosticsStatusNotification));
  }

  public async executeDataTransfer(chargingStationID: string, dataTransfer: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse> {
    return this.execute(this.buildSOAPRequest(chargingStationID, 'DataTransfer', dataTransfer));
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

  private buildSOAPRequest(chargeBoxIdentity: string, action: string, payload: any): any {
    return {
      name: action,
      headers: {
        chargeBoxIdentity: chargeBoxIdentity,
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
