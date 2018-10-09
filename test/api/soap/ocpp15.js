"use strict";

const soap = require('strong-soap').soap;
const XMLHandler = soap.XMLHandler;
const xmlHandler = new XMLHandler();
const config = require('../../config');
module.exports = class Ocpp15 {

  async init(url, options) {
    this.client = await new Promise(function(resolve, reject) {
      soap.createClient(url, options, (err, client) => {
        if (err) {
          reject(err);
        } else {
          resolve(client);
        }
      });
    });
    this.service = this.client['CentralSystemService']['CentralSystemServiceSoap12'];
  }

  executeAuthorize(chargeBoxIdentity, payload, expectations) {
    return this.execute({
      name: 'Authorize',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      payload: payload
    }, expectations);
  }

  executeStartTransaction(chargeBoxIdentity, payload, expectations) {
    return this.execute({
      name: 'StartTransaction',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      payload: payload
    }, expectations);
  }

  executeStopTransaction(chargeBoxIdentity, payload, expectations) {
    return this.execute({
      name: 'StopTransaction',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      payload: payload
    }, expectations);
  }

  executeHeartbeat(chargeBoxIdentity, payload, expectations) {
    return this.execute({
      name: 'Heartbeat',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      payload: payload
    }, expectations);
  }

  executeMeterValues(chargeBoxIdentity, payload, expectations) {
    return this.execute({
      name: 'MeterValues',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      payload: payload
    }, expectations);
  }

  executeBootNotification(chargeBoxIdentity, address, payload, expectations) {
    return this.execute({
      name: 'BootNotification',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity,
        From: {
          Address: address
        }
      },
      payload: payload
    }, expectations);
  }

  executeStatusNotification(chargeBoxIdentity, payload, expectations) {
    return this.execute({
      name: 'StatusNotification',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      payload: payload
    }, expectations);
  }

  executeFirmwareStatusNotification(chargeBoxIdentity, payload, expectations) {
    return this.execute({
      name: 'FirmwareStatusNotification',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      payload: payload
    }, expectations);
  }

  executeDiagnosticsStatusNotification(chargeBoxIdentity, payload, expectations) {
    return this.execute({
      name: 'DiagnosticsStatusNotification',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      payload: payload
    }, expectations);
  }

  executeDataTransfer(chargeBoxIdentity, payload, expectations) {
    return this.execute({
      name: 'DataTransfer',
      headers: {
        chargeBoxIdentity: chargeBoxIdentity
      },
      payload: payload
    }, expectations);
  }


  getRequestNameFromAction(actionName) {
    return actionName.replace(/^\w/, c => c.toLowerCase()).concat("Request")
  }

  async execute(action, expectations, options) {
    const payload = {};
    payload[this.getRequestNameFromAction(action.name)] = action.payload;
    const response = await this.send(this.service[action.name], payload, options, action.headers);
    await expectations(response);
    return response;
  }

  async send(method, payload, options, headers) {
    this.client.clearSoapHeaders();
    this.client.addSoapHeader(headers);
    const {result, envelope, soapHeader} = await method(payload, options, headers);
    if (config.get('trace_logs')) {
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


    return result || {};
  }

  xmlToJson(payload) {
    const xml = XMLHandler.parseXml(null, payload);
    return xmlHandler.xmlToJson(null, xml, null);
  }

};
