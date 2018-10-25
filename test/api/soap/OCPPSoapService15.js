const soap = require('strong-soap').soap;
const OCPPService = require('./OCPPService');
const config = require('../../config');

class OCPPSoapService15 extends OCPPService {
  constructor(serverUrl) {
    super(serverUrl);
    // Init
    this.client = null;
  }

  executeAuthorize(chargeBoxIdentity, data) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'Authorize', data)
    );
  }

  executeStartTransaction(chargeBoxIdentity, data) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'StartTransaction', data)
    );
  }

  executeStopTransaction(chargeBoxIdentity, data) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'StopTransaction', data)
    );
  }

  executeHeartbeat(chargeBoxIdentity, data) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'Heartbeat', data)
    );
  }

  executeMeterValues(chargeBoxIdentity, data) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'MeterValues', data)
    );
  }

  executeBootNotification(chargeBoxIdentity, data) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'BootNotification', data)
    );
  }

  executeStatusNotification(chargeBoxIdentity, data) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'StatusNotification', data)
    );
  }

  executeFirmwareStatusNotification(chargeBoxIdentity, data) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'FirmwareStatusNotification', data)
    );
  }

  executeDiagnosticsStatusNotification(chargeBoxIdentity, data) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'DiagnosticsStatusNotification', data)
    );
  }

  executeDataTransfer(chargeBoxIdentity, data) {
    return this._execute(
      this._buildSOAPRequest(chargeBoxIdentity, 'DataTransfer', data)
    );
  }

  async _execute(request, options) {
    // Init Client (Done only once)
    await this._initSOAPClient();
    // Log
    if (config.get('ocpp.logs') === 'json') {
      console.log(JSON.stringify({
        request,
        options
      }, null, 2));
    }
    // Init SOAP header
    this.client.clearSoapHeaders();
    this.client.addSoapHeader(request.headers);
    // Build the SOAP Request
    const data = {};
    data[this._getRequestNameFromAction(request.name)] = request.data;
    try {
      // Execute it
      const { result, envelope, soapHeader } = await this.service[request.name](data);
      // Log
      if (config.get('ocpp.logs') === 'xml') {
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
      if (config.get('ocpp.logs') === 'json') {
        console.log(JSON.stringify(response, null, 2));
      }
      // Return response
      return response;
    } catch (error) {
      console.log(error);      
    }
  }

  _buildSOAPRequest(chargeBoxIdentity, action, data) {
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
      data
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
        soap.createClient('test/api/soap/OCPPCentralSystemService1.5.wsdl', options, (err, client) => {
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