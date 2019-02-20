const soap = require('strong-soap').soap;
const {performance} = require('perf_hooks');
const ConnectionStorage = require("../../../../storage/mongodb/ConnectionStorage");

class ERPService {

  constructor(serverUrl, user, password) {
    this.serverUrl = serverUrl;
    this.client = null;
    this.user = user;
    this.password = password;
  }

  /**
   *
   * @param user {User}
   * @returns {Promise<void>}
   */
  async createInvoice(tenantId, user) {
    const connection = await ConnectionStorage.getConnectionByUserId(tenantId, 'convergent-invoicing', user.getID());
    const invoiceCreateRequest = new InvoiceCreateRequest(connection.getData().gpart, connection.getData().vkont, 1, 'SDBC', 'YN');
    const result = await this.execute(invoiceCreateRequest);
    if (!result.data.InvoiceDocumentNumber) {
      if (result.data.ReturnedMessage.detail[2].$attributes.value === '115') {
        return null;
      }
      throw  new Error(result.data.ReturnedMessage.detail.find(d => d.$attributes.name === 'MESSAGE').value);
    }
    return result.data.InvoiceDocumentNumber;
  }

  async getInvoiceDocumentHeader(invoiceDocumentNumber) {
    const invoiceDocumentSelectRequest = new InvoiceDocumentSelectRequest(invoiceDocumentNumber);
    const result = await this.execute(invoiceDocumentSelectRequest);
    if (!result.data.FKKInvDoc_H) {
      throw  new Error(result.data.error.message);
    }
    return result.data.FKKInvDoc_H;
  }

  async getInvoiceDocument(invoiceDocumentHeader, invoiceDocumentNumber) {
    const invoiceDocumentPrintRequest = new InvoiceDocumentPrintRequest(invoiceDocumentHeader, invoiceDocumentNumber);
    const result = await this.execute(invoiceDocumentPrintRequest);
    if (!result.data.INVDOCPDF2) {
      return null
    }
    const hexPayload = result.data.INVDOCPDF2.map(doc => doc.detail.$attributes.value).join('');
    return Buffer.from(hexPayload, 'hex');
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
        soap.createClient(__dirname+'/wsdl/erpservices_1.wsdl', options, (err, client) => {
          if (err) {
            reject(err);
          } else {
            resolve(client);
          }
        });
      });
      // Set endpoint
      this.client.setEndpoint(`${this.serverUrl}/ARTIX/erpservices`);
      this.client.setSecurity(new soap.ClientSSLSecurity(
        __dirname+'/ssl/hybris-access.key'
        , __dirname+'/ssl/hybris-access.crt'
        , {rejectUnauthorized: false, strictSSL: false}
      ));
      this.service = this.client['ERP']['ERPPort'];
    }
  }
}

module.exports = ERPService;

class InvoiceCreateRequest {
  constructor(I_GPART, I_VKONT, I_MAX_PROBCL, I_BILLING_PROCESS, I_INVOICE_PROCESS, I_PROCESS, I_BILLING_DATE, I_INVOICE_DATE,
              I_INVOICE_BLDAT, I_INVOICE_BUDAT, I_INVOICE_FIKEY) {
    this.I_GPART = I_GPART;
    this.I_VKONT = I_VKONT;
    this.I_MAX_PROBCL = I_MAX_PROBCL;
    this.I_BILLING_PROCESS = I_BILLING_PROCESS;
    // this.I_PROCESS = I_PROCESS;
    // this.I_BILLING_DATE = I_BILLING_DATE;
    this.I_INVOICE_PROCESS = I_INVOICE_PROCESS;
    // this.I_INVOICE_DATE = I_INVOICE_DATE;
    // this.I_INVOICE_BLDAT = I_INVOICE_BLDAT;
    // this.I_INVOICE_BUDAT = I_INVOICE_BUDAT;
    // this.I_INVOICE_FIKEY = I_INVOICE_FIKEY;
  }

  getName() {
    return 'InvoiceCreate';
  }
}

class InvoiceDocumentSelectRequest {
  constructor(invoiceDocumentNumber) {
    this.InvoiceDocumentNumber = invoiceDocumentNumber;
  }

  getName() {
    return 'InvoiceDocumentSelect';
  }
}

class InvoiceDocumentPrintRequest {
  constructor(invoiceDocumentHeader, invoiceDocumentNumber) {

    this.INVDOCHEADER = {
      APPL_AREA: invoiceDocumentHeader.APPLK,
      BUSINESS_PARTNER: invoiceDocumentHeader.GPART,
      CONT_ACCT: invoiceDocumentHeader.VKONT,
      CREATE_DATE: invoiceDocumentHeader.INVOICE_BASEDATE.replace(/-/g, ''),
      CREATE_MODE: invoiceDocumentHeader.CRMODE,
      CREATE_TIME: invoiceDocumentHeader.CRTIME.replace(/:/g, ''),
      CREATED_BY: invoiceDocumentHeader.CRNAME,
      DISCOUNT_DUE_DATE: invoiceDocumentHeader.FAEDS.replace(/-/g, ''),
      DOC_DATE: invoiceDocumentHeader.BLDAT.replace(/-/g, ''),
      DOC_TYPE: invoiceDocumentHeader.DOCTYPE,
      FORM_KEY: invoiceDocumentHeader.FORMKEY,
      INV_CATEGORY: invoiceDocumentHeader.INV_CATEGORY,
      INV_PERIOD: invoiceDocumentHeader.INVPERIOD.replace(/-/g, ''),
      INV_PROCESS: invoiceDocumentHeader.INV_PROCESS,
      INV_TYPE: invoiceDocumentHeader.INV_TYPE,
      INVDOC_NO: invoiceDocumentNumber,
      NET_DATE: invoiceDocumentHeader.FAEDN.replace(/-/g, ''),
      POST_DATE: invoiceDocumentHeader.BUDAT.replace(/-/g, ''),
      RECONCILIATION_KEY: invoiceDocumentHeader.FIKEY,
      TOTAL_AMOUNT: invoiceDocumentHeader.TOTAL_AMT,
      TOTAL_CURRENCY: invoiceDocumentHeader.TOTAL_CURR,
      TOTAL_CURRENCY_ISO: invoiceDocumentHeader.TOTAL_CURR,
      X_INVOICED: invoiceDocumentHeader.INVOICED,
    };
    this.X_GETPDF = 'X'
  }

  getName() {
    return 'InvoiceDocumentPrint';
  }
}