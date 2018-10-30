const soap = require('strong-soap').soap;
const OCPPService = require('../OCPPService');
const config = require('../../../config');

class OCPPSoapService15 extends OCPPService {
  constructor(serverUrl) {
    super(serverUrl);
    // Init
    this.client = null;
  }

  getVersion() {
    return "1.5";
  }

  executeAuthorize(tenantID, chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(tenantID, chargeBoxIdentity, 'Authorize', payload)
    );
  }

  executeStartTransaction(tenantID, chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(tenantID, chargeBoxIdentity, 'StartTransaction', payload)
    );
  }

  executeStopTransaction(tenantID, chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(tenantID, chargeBoxIdentity, 'StopTransaction', payload)
    );
  }

  executeHeartbeat(tenantID, chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(tenantID, chargeBoxIdentity, 'Heartbeat', payload)
    );
  }

  executeMeterValues(tenantID, chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(tenantID, chargeBoxIdentity, 'MeterValues', payload)
    );
  }

  executeBootNotification(tenantID, chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(tenantID, chargeBoxIdentity, 'BootNotification', payload)
    );
  }

  executeStatusNotification(tenantID, chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(tenantID, chargeBoxIdentity, 'StatusNotification', payload)
    );
  }

  executeFirmwareStatusNotification(tenantID, chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(tenantID, chargeBoxIdentity, 'FirmwareStatusNotification', payload)
    );
  }

  executeDiagnosticsStatusNotification(tenantID, chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(tenantID, chargeBoxIdentity, 'DiagnosticsStatusNotification', payload)
    );
  }

  executeDataTransfer(tenantID, chargeBoxIdentity, payload) {
    return this._execute(
      this._buildSOAPRequest(tenantID, chargeBoxIdentity, 'DataTransfer', payload)
    );
  }

  async _execute(request) {
    // Init Client (Done only once)
    await this._initSOAPClient();
    // Log
    if (config.get('ocpp.soap.logs') === 'json') {
      console.log(JSON.stringify({
        request
      }, null, 2));
    }
    // Init SOAP header
    this.client.clearSoapHeaders();
    this.client.addSoapHeader(request.headers);
    // Build the SOAP Request
    const payload = {};
    payload[this._getRequestNameFromAction(request.name)] = request.data;
    try {
      // Execute it
      const { result, envelope, soapHeader } = await this.service[request.name](payload);
      // Log
      if (config.get('ocpp.soap.logs') === 'xml') {
        console.log('<!-- Request -->');
        console.log(this.client.lastRequest);
        if (soapHeader) {
          console.log('<!-- Response Header -->');
          console.log(soapHeader)
        }
        console.log('<!-- Response Envelope -->');
        console.log(envelope);
        console.log('\n');
      }
      // Respond
      const response = {
        headers: soapHeader || {},
        data: result || {}
      };
      // Log Response
      if (config.get('ocpp.soap.logs') === 'json') {
        console.log(JSON.stringify(response, null, 2));
      }
      // Return response
      return response;
    } catch (error) {
      console.log(error);      
    }
  }

  _buildSOAPRequest(tenantID, chargeBoxIdentity, action, payload) {
    return {
      name: action,
      headers: {
        chargeBoxIdentity: chargeBoxIdentity,
        tenantID: tenantID,
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