const soap = require('strong-soap').soap;
const OCPPService = require('../OCPPService');
const config = require('../../../config');
const { performance } = require('perf_hooks');

class OCPPSoapService15 extends OCPPService {
  constructor(serverUrl) {
    super(serverUrl);
    // Init
    this.client = null;
  }

  getVersion() {
    return "1.5";
  }

  executeAuthorize(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'Authorize', payload)
    );
  }

  executeStartTransaction(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'StartTransaction', payload)
    );
  }

  executeStopTransaction(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'StopTransaction', payload)
    );
  }

  executeHeartbeat(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'Heartbeat', payload)
    );
  }

  executeMeterValues(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'MeterValues', payload)
    );
  }

  executeBootNotification(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'BootNotification', payload)
    );
  }

  executeStatusNotification(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'StatusNotification', payload)
    );
  }

  executeFirmwareStatusNotification(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'FirmwareStatusNotification', payload)
    );
  }

  executeDiagnosticsStatusNotification(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'DiagnosticsStatusNotification', payload)
    );
  }

  executeDataTransfer(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'DataTransfer', payload)
    );
  }

  async _execute(request) {
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
      // eslint-disable-next-line no-console
      console.log(error);
    }
  }

  _buildSOAPRequest(chargeBoxIdentity, action, payload) {
    return {
      name: action,
      headers: {
        chargeBoxIdentity: chargeBoxIdentity,
        From: {
          Address: "http://www.w3.org/2005/08/addressing/anonymous"
        },
        To: this.serverUrl,
        ReplyTo: {
          "Address": "http://www.w3.org/2005/08/addressing/anonymous"
        }
      },
      data: payload
    }
  }

  _getRequestNameFromAction(actionName) {
    return actionName.replace(/^\w/, c => c.toLowerCase()).concat("Request")
  }

  async _initSOAPClient() {
    // Client options
    const options = {};
    // Check
    if (!this.client) {
      // Create the Promise
      this.client = await new Promise(function (resolve, reject) {
        // Create the client
        soap.createClient('test/api/ocpp/soap/OCPPCentralSystemService1.5.wsdl', options, (err, client) => {
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

module.exports = OCPPSoapService15;