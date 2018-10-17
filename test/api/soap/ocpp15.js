"use strict";

const soap = require('strong-soap').soap;
const XMLHandler = soap.XMLHandler;
const xmlHandler = new XMLHandler();
const config = require('../../config');
module.exports = class Ocpp15 {

  async init(baseUrl, options) {
    this.endpoint = options.endpoint;
    this.client = await new Promise(function(resolve, reject) {
      soap.createClient(baseUrl, options, (err, client) => {
        if (err) {
          reject(err);
        } else {
          resolve(client);
        }
      });
    });
    this.service = this.client['CentralSystemService']['CentralSystemServiceSoap12'];
  }

  executeAuthorize(chargeBoxIdentity, data) {
    return this.execute({
      name: 'Authorize',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      data: data
    });
  }

  executeStartTransaction(chargeBoxIdentity, data) {
    return this.execute({
      name: 'StartTransaction',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      data: data
    });
  }

  executeStopTransaction(chargeBoxIdentity, data) {
    return this.execute({
      name: 'StopTransaction',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      data: data
    });
  }

  executeHeartbeat(chargeBoxIdentity, data) {
    return this.execute({
      name: 'Heartbeat',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      data: data
    });
  }

  executeMeterValues(chargeBoxIdentity, data) {
    return this.execute({
      name: 'MeterValues',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      data: data
    });
  }

  executeBootNotification(chargeBoxIdentity, address, data) {
    return this.execute({
      name: 'BootNotification',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity,
        From: {
          Address: address
        }
      },
      data: data
    });
  }

  executeStatusNotification(chargeBoxIdentity, data) {
    return this.execute({
      name: 'StatusNotification',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      data: data
    });
  }

  executeFirmwareStatusNotification(chargeBoxIdentity, data) {
    return this.execute({
      name: 'FirmwareStatusNotification',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      data: data
    });
  }

  executeDiagnosticsStatusNotification(chargeBoxIdentity, data) {
    return this.execute({
      name: 'DiagnosticsStatusNotification',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      data: data
    });
  }

  executeDataTransfer(chargeBoxIdentity, data) {
    return this.execute({
      name: 'DataTransfer',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      data: data
    });
  }


  getRequestNameFromAction(actionName) {
    return actionName.replace(/^\w/, c => c.toLowerCase()).concat("Request")
  }

  async execute(action, options) {
    const data = {};
    data[this.getRequestNameFromAction(action.name)] = action.data;
    const response = await this.send(this.service[action.name], data, options, action.headers);
    return response;
  }

  async send(method, data, options, headers) {
    this.client.clearSoapHeaders();
    this.client.addSoapHeader(headers);
    if (config.get('ocpp.logs') === 'json') {
      console.log(JSON.stringify(
        {
          endpoint: this.endpoint,
          headers: headers,
          ...data,
          options: options
        }, null, 2));
    }
    const {result, envelope, soapHeader} = await method(data, options, headers);
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

    const response = {
      headers: soapHeader || {},
      data: result || {}
    };
    if (config.get('ocpp.logs') === 'json') {
      console.log(JSON.stringify(response, null, 2));
    }
    return response;
  }

  xmlToJson(data) {
    const xml = XMLHandler.parseXml(null, data);
    return xmlHandler.xmlToJson(null, xml, null);
  }

};
