const uuid = require('uuid/v4');
const Logging = require('../../utils/Logging'); 
const ChargingStationClient = require('../ChargingStationClient');

const _moduleName = "JSONClientService";

class JsonChargingStationClient16 extends ChargingStationClient {

    constructor(wsHandler) {
        super();
        this._wsHandler = wsHandler;
    }

    getChargeBoxId () {
        return this._wsHandler.getChargeBoxId();
    }

    startTransaction(idTag, connectorId, chargingProfile = {}) {
        const payload = { connectorId:connectorId, idTag: idTag };
        if (chargingProfile !== null && Object.getOwnPropertyNames(chargingProfile).length > 0 ) {
            payload.chargingProfile = chargingProfile;
        }
        return this._wsHandler.sendMessage(uuid(), payload, 2, "RemoteStartTransaction");
    }

    reset(type) {
        return this._wsHandler.sendMessage(uuid(), {type:type}, 2, "Reset");
	}

	clearCache() {
        return this._wsHandler.sendMessage(uuid(), {}, 2, "ClearCache");
	}

	getConfiguration(keys) {
        return this._wsHandler.sendMessage(uuid(), ((keys === null)? {} : {key:keys}), 2, "GetConfiguration");
	}

	changeConfiguration(key, value) {
        return this._wsHandler.sendMessage(uuid(), {key:key, value: value}, 2, "ChangeConfiguration");
	}

	stopTransaction(transactionId) {
        return this._wsHandler.sendMessage(uuid(), {transactionId:transactionId}, 2, "RemoteStopTransaction");
	}

	unlockConnector(connectorId) {
        return this._wsHandler.sendMessage(uuid(), {connectorId:connectorId}, 2, "UnlockConnector");
	}
}

module.exports = JsonChargingStationClient16;