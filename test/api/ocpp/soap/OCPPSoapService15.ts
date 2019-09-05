import { performance } from 'perf_hooks';
import soap from 'strong-soap';
import OCPPService from '../OCPPService';

export default class OCPPSoapService15 extends OCPPService {
  public client: any;
  public service: any;
  public constructor(serverUrl) {
    super(serverUrl);
    // Init
    this.client = null;
  }

  public getVersion() {
    return '1.5';
  }

  public async executeAuthorize(chargeBoxIdentity, payload) {
    return await this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'Authorize', payload)
    );
  }

  public async executeStartTransaction(chargeBoxIdentity, payload) {
    return await this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'StartTransaction', payload)
    );
  }

  public async executeStopTransaction(chargeBoxIdentity, payload) {
    return await this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'StopTransaction', payload)
    );
  }

  public async executeHeartbeat(chargeBoxIdentity, payload) {
    return await this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'Heartbeat', payload)
    );
  }

  public async executeMeterValues(chargeBoxIdentity, payload) {
    return await this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'MeterValues', payload)
    );
  }

  public async executeBootNotification(chargeBoxIdentity, payload) {
    return await this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'BootNotification', payload)
    );
  }

  public async executeStatusNotification(chargeBoxIdentity, payload) {
    return await this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'StatusNotification', payload)
    );
  }

  public async executeFirmwareStatusNotification(chargeBoxIdentity, payload) {
    return await this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'FirmwareStatusNotification', payload)
    );
  }

  public async executeDiagnosticsStatusNotification(chargeBoxIdentity, payload) {
    return await this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'DiagnosticsStatusNotification', payload)
    );
  }

  public async executeDataTransfer(chargeBoxIdentity, payload) {
    return await this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'DataTransfer', payload)
    );
  }

  private async _execute(request) {
    // Init Client (Done only once)
    await this._initSOAPClient();
    // Init SOAP header
    this.client.clearSoapHeaders();
    this.client.addSoapHeader(request.headers);
    // Build the SOAP Request
    const payload = {};
    payload[this._getRequestNameFromAction(request.name)] = request.data;
    let t0 = 0;
    let t1 = 0;
    try {
      // Execute it
      t0 = performance.now();
      const { result, envelope, soapHeader } = await this.service[request.name](payload);
      t1 = performance.now();
      // Respond
      const response = {
        executionTime: (t1 - t0),
        headers: soapHeader || {},
        data: result || {}
      };
      // Return response
      return response;
    } catch (error) {
    }
  }

  private _buildSOAPRequest(chargeBoxIdentity, action, payload) {
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

  private _getRequestNameFromAction(actionName) {
    return actionName.replace(/^\w/, (c) => c.toLowerCase()).concat('Request');
  }

  private async _initSOAPClient() {
    // Client options
    const options = {};
    // Check
    if (!this.client) {
      // Create the Promise
      this.client = await new Promise(function(resolve, reject) {
        // Create the client
        soap.soap.createClient('src/assets/server/ocpp/OCPPCentralSystemService15.wsdl', options, (err, client) => {
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
