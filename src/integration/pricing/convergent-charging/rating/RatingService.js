const soap = require('strong-soap').soap;
const {performance} = require('perf_hooks');

class RatingService {

  constructor(serverUrl, user, password) {
    this.serverUrl = serverUrl;
    this.client = null;
    this.user = user;
    this.password = password;
  }

  async loadChargedItemsToInvoicing() {
    await this.execute(new ChargedItemLoadRequest());
    return this.timeout(3000);
  }

  timeout(delayms) {
    return new Promise(resolve => setTimeout(resolve, delayms));
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
    // if (config.get('ocpp.soap.logs') === 'json') {
    console.log(JSON.stringify({
      request
    }, null, 2));
    // }
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
      // if (config.get('ocpp.soap.logs') === 'xml') {
      console.log('<!-- Request -->');
      console.log(this.client.lastRequest);
      if (soapHeader) {
        console.log('<!-- Response Header -->');
        console.log(soapHeader)
      }
      console.log('<!-- Response Envelope -->');
      console.log(envelope);
      console.log('\n');
      // }
      // Respond
      const response = {
        executionTime: (t1 - t0),
        headers: soapHeader || {},
        data: result || {}
      };
      // Log Response
      // if (config.get('ocpp.soap.logs') === 'json') {
      console.log(JSON.stringify(response, null, 2));
      // }
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
    }
  }

  // _getRequestNameFromAction(actionName) {
  //   return actionName.replace(/^\w/, c => c.toLowerCase()).concat("Request")
  // }

  async _initSOAPClient() {
    // Client options
    const options = {};
    // Check
    if (!this.client) {
      // Create the Promise
      this.client = await new Promise(function(resolve, reject) {
        // Create the client
        soap.createClient(__dirname + '/wsdl/rating_1.wsdl', options, (err, client) => {
          if (err) {
            reject(err);
          } else {
            resolve(client);
          }
        });
      });
      // Set endpoint
      this.client.setEndpoint(`${this.serverUrl}/ARTIX/rating`);
      this.client.setSecurity(new soap.ClientSSLSecurity(
        __dirname + '/ssl/hybris-access.key'
        , __dirname + '/ssl/hybris-access.crt'
        , {rejectUnauthorized: false, strictSSL: false}
      ));
      this.service = this.client['rating']['RatingServicesPort'];
    }
  }
}

module.exports = RatingService;


class ChargedItemLoadRequest {
  getName() {
    return 'chargedItemLoad';
  }
}