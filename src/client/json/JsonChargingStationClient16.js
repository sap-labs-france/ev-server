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
        let payload = { connectorId:connectorId, idTag: idTag};
        if (chargingProfile !== null && Object.getOwnPropertyNames(chargingProfile).length > 0 ) {
            payload.chargingProfile = chargingProfile;
        }

        return this._wsHandler.sendMessage(uuid(), payload, 2, "RemoteStartTransaction").then(
                (payload)=> { 
                    return payload; 
                }, 
                (error)=> { 
                    Logging.logError({ module: _moduleName, method: "startTransaction", action: "sendMessage",
                                                    message: JSON.stringify(error, null, " ")  });
                    throw error;
                } );
    }

    reset(type) {
        return this._wsHandler.sendMessage(uuid(), {type:type}, 2, "Reset").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                Logging.logError({ module: _moduleName, method: "reset", action: "sendMessage",
                                                message: JSON.stringify(error, null, " ")  });
                throw error;
            } );
	}

	clearCache() {
        return this._wsHandler.sendMessage(uuid(), {}, 2, "ClearCache").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                Logging.logError({ module: _moduleName, method: "clearCache", action: "sendMessage",
                                                message: JSON.stringify(error, null, " ")  });
                throw error;
            } );
	}

	getConfiguration(keys) {
        return this._wsHandler.sendMessage(uuid(), ((keys === null)? {} : {key:keys}), 2, "GetConfiguration").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                Logging.logError({ module: _moduleName, method: "getConfiguration", action: "sendMessage",
                                                message: JSON.stringify(error, null, " ")  });
                throw error;
            } );
	}

	changeConfiguration(key, value) {
        return this._wsHandler.sendMessage(uuid(), {key:key, value: value}, 2, "ChangeConfiguration").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                Logging.logError({ module: _moduleName, method: "ChangeConfiguration", action: "sendMessage",
                                                message: JSON.stringify(error, null, " ")  });
                throw error;
            } );
	}

	stopTransaction(transactionId) {
        return this._wsHandler.sendMessage(uuid(), {transactionId:transactionId}, 2, "RemoteStopTransaction").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                Logging.logError({ module: _moduleName, method: "stopTransaction", action: "sendMessage",
                                                message: JSON.stringify(error, null, " ")  });
                throw error;
            } );
	}

	unlockConnector(connectorId) {
        return this._wsHandler.sendMessage(uuid(), {connectorId:connectorId}, 2, "UnlockConnector").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                Logging.logError({ module: _moduleName, method: "unlockConnector", action: "sendMessage",
                                                message: JSON.stringify(error, null, " ")  });
                throw error;
            } );
	}
}

module.exports = JsonChargingStationClient16;