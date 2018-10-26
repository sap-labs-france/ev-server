const soap = require('strong-soap').soap;
const OCPPService = require('../OCPPService');
const config = require('../../../config');

class OCPPJsonService16 extends OCPPService {
  constructor(serverUrl) {
    super(serverUrl);
  }

  executeAuthorize(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildRequest(chargeBoxIdentity, 'Authorize', payload)
    );
  }

  executeStartTransaction(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildRequest(chargeBoxIdentity, 'StartTransaction', payload)
    );
  }

  executeStopTransaction(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildRequest(chargeBoxIdentity, 'StopTransaction', payload)
    );
  }

  executeHeartbeat(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildRequest(chargeBoxIdentity, 'Heartbeat', payload)
    );
  }

  executeMeterValues(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildRequest(chargeBoxIdentity, 'MeterValues', payload)
    );
  }

  executeBootNotification(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildRequest(chargeBoxIdentity, 'BootNotification', payload)
    );
  }

  executeStatusNotification(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildRequest(chargeBoxIdentity, 'StatusNotification', payload)
    );
  }

  executeFirmwareStatusNotification(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildRequest(chargeBoxIdentity, 'FirmwareStatusNotification', payload)
    );
  }

  executeDiagnosticsStatusNotification(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildRequest(chargeBoxIdentity, 'DiagnosticsStatusNotification', payload)
    );
  }

  executepayloadTransfer(chargeBoxIdentity, payload) {
    return this._execute(
      this._buildRequest(chargeBoxIdentity, 'payloadTransfer', payload)
    );
  }

  async _execute(request, options) {
  }

  _buildRequest(chargeBoxIdentity, command, payload) {
  }
}

module.exports = OCPPJsonService16;