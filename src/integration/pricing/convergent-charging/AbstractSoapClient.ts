const soap = require('strong-soap').soap;
import { performance } from 'perf_hooks';
import SoapRequest from './SoapRequest';

export default abstract class AbstractSoapClient {
  public result: any;
  public envelope: any;
  public soapHeader: any;
  private service: any;
  private client: any;

  //TODO: type service, clientSSLSecurity, client. for the latter two need
  // to reverse-engineer strong-soap (Package @types/strong-soap doesnt exist)...
  public constructor(
    readonly endpointUrl: string,
    readonly wsdlPath: string,
    service: any,
    readonly port: string,
    readonly user: string,
    readonly password: string,
    readonly clientSSLSecurity: any)
  {
    this.service = service;
  }

  //TODO: type incoming request.
  public execute(request: any): Promise<{executionTime: number; headers: any; data: any}> {
    return this._execute(
      this._buildSOAPRequest(request.getName(), request)
    );
  }

  //TODO: soap headers and data has to be typed.
  private async _execute(request: SoapRequest): Promise<{executionTime: number; headers: any; data: any}> {
    // Init Client (Done only once)
    await this._initSOAPClient();
    // Log
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      request
    }, null, 2));
    // Init SOAP header
    this.client.clearSoapHeaders();
    this.client.addSoapHeader(request.headers);
    // Build the SOAP Request
    const payload: any = {};
    payload[request.requestName] = request.data;
    // payload[this._getRequestNameFromAction(request.name)] = request.data;
    let t0 = 0;
    let t1 = 0;
    try {
      // Execute it
      t0 = performance.now();
      const functionToCall = this.service[request.name];
      //TODO: type this
      // eslint-disable-next-line no-unused-vars
      const { result, envelope, soapHeader } = await functionToCall(payload);
      t1 = performance.now();
      // Log
      // Respond
      const response = {
        executionTime: (t1 - t0),
        headers: soapHeader || {},
        data: result || {}
      };
      // Log Response
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(response, null, 2));
      // Return response
      return response;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(error);
      return {
        executionTime: -1,
        headers: false,
        data: false
      };//TODO check if this is wanted behavior. Why not throw an error?
    }
  }

  private _buildSOAPRequest(action: string, payload: any): SoapRequest {
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

  private async _initSOAPClient(): Promise<void> {
    // Client options
    const options: any = {};
    // Check
    if (!this.client) {
      // Create the Promise
      this.client = await new Promise((resolve, reject) => {
        // Create the client
        soap.createClient(this.wsdlPath, options, (err: any, client: any) => {
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
