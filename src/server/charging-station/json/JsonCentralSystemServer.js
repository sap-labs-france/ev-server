const fs = require('fs');
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const CentralSystemServer = require('../CentralSystemServer');
const Logging = require('../../../utils/Logging');
const JsonWSClientConnection = require ('./JsonWSClientConnection');

let _centralSystemConfig;
let _chargingStationConfig;

//const debug = (message) => { console.log(message); };

class JsonCentralSystemServer extends CentralSystemServer {
    
    constructor(centralSystemConfig, chargingStationConfig) {
		// Call parent
		super(centralSystemConfig, chargingStationConfig);

		// Keep local
		_centralSystemConfig = centralSystemConfig;
        _chargingStationConfig = chargingStationConfig;
        this._jsonClients = [];
    }   
    
    start(){
        let server;
        global.centralSystemJson = this;
        if (_centralSystemConfig.protocol === "wss") {
			// Create the options
			let options = {};
			// Set the keys
			options.key = fs.readFileSync(_centralSystemConfig["ssl-key"]);
            options.cert = fs.readFileSync(_centralSystemConfig["ssl-cert"]);
            Logging.logDebug({
                module: "JsonCentralSystemServer", method: "start", action: "",
                message: `Starting JSON HTTPS Server`
            });
			// Https server
			server = https.createServer(options, (req, res) => {
                res.writeHead(200);
                res.end('No support\n');
            });
		} else {
//            debug("JSON: Starting HTTP server");
            Logging.logDebug({
                module: "JsonCentralSystemServer", method: "start", action: "",
                message: `Starting JSON HTTP Server`
            });
			// Http server
			server = http.createServer((req, res) => {
                res.writeHead(200);
                res.end('No support\n');
            });
		}

        var verifyClient = function(info) {
//            debug("Verify connection : ", info.origin, info.req, info.secure);
            if (info.req.url.startsWith("/OCPP16/") === false) {
                Logging.logError({
                    module: "JsonCentralSystemServer", method: "verifyClient", action: "connection",
                    message: `Invalid connection URL ${info.req} from ${info.origin}`
                });              
                return false;
            }
/*            if (info.req.headers["sec-websocket-protocol"] !== "ocpp1.6") {
                return false;
            }*/
            return true;
        }

        this._wss = new WebSocket.Server({
            server: server,
            verifyClient: verifyClient,
            handleProtocols: (protocols, request) => {
// Ensure protocol used as ocpp1.6 or nothing (should create an error)
                if (Array.isArray(protocols)) {
                    return (protocols.indexOf("ocpp1.6") >= 0 ?  protocols[protocols.indexOf("ocpp1.6")] : false);
                } else if (protocols === "ocpp1.6") {
                    return protocols;
                } else {
                    return false;
                }
            }
        });

        this._wss.on('connection', (ws, req) => {
//            debug(Date().toString() + ' ' + JSON.stringify(this._wss.clients));
            try {
// construct the WS manager
                let connection = new JsonWSClientConnection(ws, req);
// Store the WS manager linked to its ChargeBoxId
                this._jsonClients[connection.getChargeBoxId()] = connection;
            } catch (error) {
                Logging.logError({
                    module: "JsonCentralSystemServer", method: "onConnection", action: "socketError",
                    message: `Connection Error ${error}`
                });
//                debug("On Connection error : " + error.message);
                ws.close(1007, error.message);
            }
        });

        server.listen(_centralSystemConfig.port, _centralSystemConfig.host, () => {
            // Log
            Logging.logInfo({
                module: "JsonCentralSystemServer", method: "start", action: "Startup",
                message: `JSON Central System Server (Charging Stations) listening on '${_centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'`
            });
//            debug(`JSON Central System Server (Charging Stations) listening on '${_centralSystemConfig.protocol}://${server.address().address}:${server.address().port}'`);
        });
        
    }

    closeConnection(chargeBoxId) {
        delete this._jsonClients[chargeBoxId];
    }

    getConnection(chargeBoxId) {
        return this._jsonClients[chargeBoxId];
    }

}
module.exports = JsonCentralSystemServer;