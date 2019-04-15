const soap = require('strong-soap').soap;
const {performance} = require('perf_hooks');

class AbstractSoapClient {

  constructor(endpointUrl, wsdlPath, service, port, user, password, clientSSLSecurity) {
    this.endpointUrl = endpointUrl;
    this.wsdlPath = wsdlPath;
    this.service = service;
    this.port = port;
    this.user = user;
    this.password = password;
    this.clientSSLSecurity = clientSSLSecurity;
  }

  execute(request) {
    return this._execute(
      this._buildSOAPRequest(request.getName(), request)
    );
  }

  async _execute(request) {
    // Init Client (Done only once)
    await this._initSOAPClient();
    // Log
    console.log(JSON.stringify({
      request
    }, null, 2));
    // Init SOAP header
    this.client.clearSoapHeaders();
    this.client.addSoapHeader(request.headers);
    // Build the SOAP Request
    const payload = {};
    payload[request.requestName] = request.data;
    // payload[this._getRequestNameFromAction(request.name)] = request.data;
    let t0 = 0;
    let t1 = 0;
    try {
      // Execute it
      t0 = performance.now();
      const functionToCall = this.service[request.name];
      const {result, envelope, soapHeader} = await functionToCall(payload);
      t1 = performance.now();
      // Log
      // Respond
      const response = {
        executionTime: (t1 - t0),
        headers: soapHeader || {},
        data: result || {}
      };
      // Log Response
      console.log(JSON.stringify(response, null, 2));
      // Return response
      return response;
    } catch (error) {
      console.log(error);
    }
  }

  _buildSOAPRequest(action, payload) {
    return {
      name: action,
      requestName: action + 'Request',
      headers: {
        Security: {
          Username: this.user,
          Password: this.password,
          Nonce: '0yEIcqHY/wAGjBMy76phQA=='
        }
      },
      data: payload
    };
  }

  async _initSOAPClient() {
    // Client options
    const options = {};
    // Check
    if (!this.client) {
      // Create the Promise
      this.client = await new Promise((resolve, reject) => {
        // Create the client
        soap.createClient(this.wsdlPath, options, (err, client) => {
          if (err) {
            reject(err);
          } else {
            resolve(client);
          }
        });
      });
      // Set endpoint
      this.client.setEndpoint(this.endpointUrl);
      this.client.setSecurity(this.clientSSLSecurity);
      this.service = this.client[this.service][this.port];
    }
  }
}

module.exports = AbstractSoapClient;
