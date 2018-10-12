const uuid = require('uuid/v4');
const Logging = require('../../../utils/Logging'); 
const WebSocket = require('ws');

//const Commands = require('./Commands');
const SOCKET_TIMEOUT = 30000; // 30 sec

const CALL_MESSAGE = 2; // Client-to-Server
const CALLRESULT_MESSAGE = 3; // Server-to-Client
const CALLERROR_MESSAGE = 4; // Server-to-Client
//import { getObjectValues } from './helpers';
const OCPPError = require('./OcppError');
const OCPPErrorValues = require('./OcppErrorConstants');

const debug = (message) => { console.log(message); };
const _moduleName = "centralSystemJSONService";

class JsonWSClientConnection {

    constructor(socket, req) {
//        this._commands = new Commands();
        this._socket = socket;
        this._req = req;
        this._requests = {};

        if (req) {
            this._url = req && req.url;
            const ip = req && ((req.connection && req.connection.remoteAddress) || req.headers['x-forwarded-for']);
            Logging.logInfo({
                module: _moduleName, method: "constructor", action: "connection",
                message: `New connection from "${ip}", protocol "${socket.protocol}", url "${this._url}"`
            });

            debug(`New connection from "${ip}", protocol "${socket.protocol}", url "${this._url}"`);

            if (this._url.startsWith("/OCPP16/") === false) { //In princple already checked in connection opening from server
                throw new Error("invalid url");
            }

// Fill in standard JSON object for communication with central server
            try {
                let chargeBoxIdWithNameSpace = this._url.split("/")[2];

                this._headers = {
                    chargeBoxIdentity: this._url.split("/")[2],
                    ocppVersion: (socket.protocol.startsWith("ocpp") ? socket.protocol.replace("ocpp", "") : socket.protocol),
                    From : {
                        Address: ip
                }
            }; 
            } catch (error) {
                throw new Error("invalid url");
            }
            
        } else {
// should not happen as connection is initiated by the box always
            throw new Error("invalid url");
        }

        // Check protocol
        if (this._socket.protocol !== "ocpp1.6") { //it is a require field of OCPP spec
            throw new Error("protocol not supported");
        } 

        socket.on('message', (msg) => this.onMessage(msg));

        socket.on('error', (err) => {
            Logging.logError({
                module: _moduleName, method: "OnError", action: "connectionError",
                message: err
            });
            debug(err);
        });

        socket.on('close', (code, reason) => {
            Logging.logInfo({
                module: _moduleName, method: "OnClose", action: "connectionClose",
                message: {code: code, reason: reason}
            });
            debug("client closed ", code, " ", reason);
            global.centralSystemJson.closeConnection(this.getChargeBoxId());
        })
    }

    async onMessage(message) {
        let messageType, messageId, commandNameOrPayload, commandPayload, errorDetails;

        try {
            [messageType, messageId, commandNameOrPayload, commandPayload, errorDetails] = JSON.parse(message);
        } catch (err) {
            throw new Error(`Failed to parse message: "${message}", ${err.message}`);
        }

        switch (messageType) {
            case CALL_MESSAGE:
                // request 
                debug(`>> url ${this._url} message: ${message} type: ${messageType} commandNameOrPayload: ${commandNameOrPayload} commandPayload: ${commandPayload}`);
                Logging.logReceivedAction(_moduleName, this._headers.chargeBoxIdentity, commandNameOrPayload, commandPayload, message);

                try {
                    // Check if method exist in central server
                    if ( typeof global.centralSystemJson["handle" + commandNameOrPayload] === 'function') {
                        global.centralSystemJson["handle" + commandNameOrPayload](Object.assign(commandPayload, this._headers)).then( (result) => {
                            // get answer from central server
                            // response should like { commandNameRespons : { attributes of teh response } }
                            debug("promise response to " + commandNameOrPayload + " is " + JSON.stringify(result) );
                            Logging.logReturnedAction(_moduleName, this._headers.chargeBoxIdentity, commandNameOrPayload, {
                                "result": result
                            });
                            //check if response contains proper attribute
                            let reponseNameProperty = commandNameOrPayload.charAt(0).toLowerCase() + commandNameOrPayload.slice(1) + "Response";
                            if (result.hasOwnProperty(reponseNameProperty)) {
                                this.sendMessage(messageId, result[reponseNameProperty], CALLRESULT_MESSAGE).then((result) => {
                                }, (error) => {
                                    debug("Response rejected");
                                    Logging.logError({ module: _moduleName, method: "sendMessage", action: "promiseError",
                                                    message: {message: messageId, error: error}  });
                                });
                            } else {
                                // TO DO what shall we do if we did not code it correctly :)
                            }
                        });
                    } else {
                        return await this.sendError(messageId, new OCPPError(OCPPErrorValues.ERROR_NOTIMPLEMENTED, "")).then((result) => {
                            debug("Error sent " + result );
                        });    
                    }
                    
//                    await this.sendMessage(messageId, responseObj, CALLRESULT_MESSAGE);
                } catch (err) {
                    // send error if payload didn't pass the validation
                    return await this.sendError(messageId, new OCPPError(OCPPErrorValues.ERROR_FORMATIONVIOLATION, err.message)).then((result) => {
                        debug("Error sent " + result );
                    });
                }
                break;
            case CALLRESULT_MESSAGE:
                // response
//                debug(`>> ${this._url}: ${message}`);

                const [responseCallback] = this._requests[messageId];
                if (!responseCallback) {
                    throw new Error(`Response for unknown message ${messageId}`);
                }
                delete this._requests[messageId];

                responseCallback(commandNameOrPayload);
                break;
            case CALLERROR_MESSAGE:
                // error response
//                debug(`>> ERROR ${this._url}: ${message}`);

                if (!this._requests[messageId]) {
                    throw new Error(`Response for unknown message ${messageId}`);
                }
                const [, rejectCallback] = this._requests[messageId];
                delete this._requests[messageId];

                rejectCallback(new OCPPError(commandNameOrPayload, commandPayload, errorDetails));
                break;
            default:
                throw new Error(`Wrong message type ${messageType}`);
        }
    }

    send(command, messageType = CALL_MESSAGE) {
        return this.sendMessage(uuid(), command, messageType);
    }

    sendError(messageId, err) {
        debug(`Error: ${err.message}`);
        Logging.logError({ module: _moduleName, method: "sendError", action: "OCPPError",
        message: {message: messageId, error: err}  });

        const error = err instanceof OCPPError ? err : new OCPPError(OCPPErrorValues.ERROR_INTERNALERROR, err.message);

        return this.sendMessage(messageId, error, CALLERROR_MESSAGE);
    }

    sendMessage(messageId, command, messageType = CALLRESULT_MESSAGE, commandName = "") {
// send a message through websocket
        const socket = this._socket;
        const self = this;

        return new Promise((resolve, reject) => {
            let messageToSend;

            switch (messageType) {
                case CALL_MESSAGE:
                    this._requests[messageId] = [onResponse, onRejectResponse];
                    messageToSend = JSON.stringify([messageType, messageId, commandName, command]);
                    break;
                case CALLRESULT_MESSAGE:
                    messageToSend = JSON.stringify([messageType, messageId, command]);
                    break;
                case CALLERROR_MESSAGE:
                    const {
                        code,
                        message,
                        details
                    } = command;
                    messageToSend = JSON.stringify([messageType, messageId, code, message, details]);
                    break;
            }

            debug(`<< ${messageToSend}`);
            if (socket.readyState === 1) {
                socket.send(messageToSend);
            } else {
                return onRejectResponse(`Socket closed ${messageId}`);
            }
            if (messageType !== CALL_MESSAGE) {
                resolve();
            } else {
                setTimeout(() => onRejectResponse(`Timeout for message ${messageId}`), SOCKET_TIMEOUT);
            }

            function onResponse(payload) {
//                const response = command.createResponse(payload);
                return resolve(payload);
            }

            function onRejectResponse(reason) {
                self._requests[messageId] = () => {};
                const error = reason instanceof OCPPError ? reason : new Error(reason);
                reject(error);
            }
        });
    }

    getChargeBoxId () {
        return this._headers.chargeBoxIdentity;
    }

    startTransaction(idTag, connectorId, chargingProfile = {}) {
        return this.sendMessage(uuid(), { connectorId:connectorId, idTag: idTag, chargingProfile: chargingProfile}, 2, "RemoteStartTransaction").then(
                (payload)=> { 
                    return payload; 
                }, 
                (error)=> { 
                    debug("sendMessage ERROR result", error);
                    Logging.logError({ module: _moduleName, method: "startTransaction", action: "sendMessage",
                                                    message: error  });
                } );
            //, meterStart: 32, timestamp: date }
    }

    reset(type) {
        return this.sendMessage(uuid(), {resetType:type}, 2, "Reset").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                debug("sendMessage ERROR result", error);
                Logging.logError({ module: _moduleName, method: "reset", action: "sendMessage",
                                                message: error  });
            } );
	}

	clearCache() {
        return this.sendMessage(uuid(), {}, 2, "ClearCache").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                debug("sendMessage ERROR result", error);
                Logging.logError({ module: _moduleName, method: "clearCache", action: "sendMessage",
                                                message: error  });
            } );
	}

	getConfiguration(keys) {
        return this.sendMessage(uuid(), ((keys === null)? {} : {key:keys}), 2, "GetConfiguration").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                debug("sendMessage ERROR result", error);
                Logging.logError({ module: _moduleName, method: "getConfiguration", action: "sendMessage",
                                                message: error  });
            } );
	}

	changeConfiguration(key, value) {
        return this.sendMessage(uuid(), {key:key, value: value}, 2, "ChangeConfiguration").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                debug("sendMessage ERROR result", error);
                Logging.logError({ module: _moduleName, method: "ChangeConfiguration", action: "sendMessage",
                                                message: error  });
            } );
	}

	stopTransaction(transactionId) {
        return this.sendMessage(uuid(), {transactionId:transactionId}, 2, "RemoteStopTransaction").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                debug("sendMessage ERROR result", error);
                Logging.logError({ module: _moduleName, method: "stopTransaction", action: "sendMessage",
                                                message: error  });
            } );
	}

	unlockConnector(connectorId) {
        return this.sendMessage(uuid(), {connectorId:connectorId}, 2, "UnlockConnector").then(
            (payload)=> { 
                return payload; 
            }, 
            (error)=> { 
                debug("sendMessage ERROR result", error);
                Logging.logError({ module: _moduleName, method: "unlockConnector", action: "sendMessage",
                                                message: error  });
            } );
	}
}

module.exports = JsonWSClientConnection;