import * as http from 'http';
import uuid from 'uuid/v4';
import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import global from '../../../types/GlobalType';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import CentralSystemServer from '../CentralSystemServer';
import JsonRestWSConnection from './JsonRestWSConnection';
import JsonWSConnection from './JsonWSConnection';
import WSServer from './WSServer';

export default class JsonCentralSystemServer extends CentralSystemServer {
  private _serverName: string;
  private _MODULE_NAME: string;
  private jsonChargingStationClients: JsonWSConnection[];
  private jsonRestClients: JsonRestWSConnection[];
  private wsServer: WSServer;

  constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    // Call parent
    super(centralSystemConfig, chargingStationConfig);
    // Keep local
    this._serverName = 'OCPP';
    this._MODULE_NAME = 'JsonCentralSystemServer';
    this.jsonChargingStationClients = [];
    this.jsonRestClients = [];
  }

  get MODULE_NAME() {
    return this._MODULE_NAME;
  }

  get serverName() {
    return this._serverName;
  }

  public _createWSServer() {
    const verifyClient = (info) => {
      // Check the URI
      if (info.req.url.startsWith('/OCPP16')) {
        return true;
      }
      if (info.req.url.startsWith('/REST')) {
        return true;
      }
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: this._MODULE_NAME,
        method: 'verifyClient',
        action: 'WSVerifyClient',
        message: `Invalid connection URL ${info.req.url}`
      });
      return false;
    };

    const handleProtocols = (protocols, request): boolean|string => {
      // Check the protocols
      // Ensure protocol used as ocpp1.6 or nothing (should create an error)
      if (Array.isArray(protocols)) {
        if (protocols.includes('ocpp1.6')) {
          return 'ocpp1.6';
        }
        if (protocols.includes('rest')) {
          return 'rest';
        }
        return false;
      } else if (protocols === 'ocpp1.6') {
        return protocols;
      } else if (protocols === 'rest') {
        return protocols;
      }
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: this._MODULE_NAME,
        method: 'handleProtocols',
        action: 'WSVerifyClient',
        message: `Invalid protocol ${protocols}`
      });
      return false;
    };

    // Create the WS server
    this.wsServer = new WSServer(WSServer.createHttpServer(this.centralSystemConfig), this._serverName,
      this.centralSystemConfig, verifyClient, handleProtocols);
    this.wsServer.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
      try {
        // Set an ID
        ws['id'] = uuid();
        // Check Rest calls
        if (req.url.startsWith('/REST')) {
          // Create a Rest Web Socket connection object
          const wsConnection = new JsonRestWSConnection(ws, req, this);
          // Init
          await wsConnection.initialize();
          // Add
          this.addRestConnection(wsConnection);
        } else {
          // Create a Json Web Socket connection object
          const wsConnection = new JsonWSConnection(ws, req, this.chargingStationConfig, this);
          // Init
          await wsConnection.initialize();
          // Add
          this.addJsonConnection(wsConnection);
        }
      } catch (error) {
        // Log
        Logging.logException(
          error, 'WsConnection', '', this._MODULE_NAME, 'connection', Constants.DEFAULT_TENANT);
        // Respond
        ws.close(Constants.WS_UNSUPPORTED_DATA, error.message);
      }
    });
  }

  public start() {
    // Keep it global
    global.centralSystemJson = this;
    // Make server to listen
    this._startListening();
  }

  public _startListening() {
    // Create the WS server
    this._createWSServer();
    // Make server to listen
    this.wsServer.startListening();
  }

  public addJsonConnection(wsConnection: JsonWSConnection) {
    // Keep the connection
    this.jsonChargingStationClients[wsConnection.getID()] = wsConnection;
  }

  public removeJsonConnection(wsConnection: JsonWSConnection) {
    // Check first
    if (this.jsonChargingStationClients[wsConnection.getID()] &&
      this.jsonChargingStationClients[wsConnection.getID()].getWSConnection().id === wsConnection.getWSConnection()['id']) {
      // Remove from cache
      delete this.jsonChargingStationClients[wsConnection.getID()];
    }
  }

  public addRestConnection(wsConnection: JsonRestWSConnection) {
    // Keep the connection
    this.jsonRestClients[wsConnection.getID()] = wsConnection;
  }

  public removeRestConnection(wsConnection: JsonRestWSConnection) {
    // Check first
    if (this.jsonRestClients[wsConnection.getID()] &&
      this.jsonRestClients[wsConnection.getID()].getWSConnection().id === wsConnection.getWSConnection()['id']) {
      // Remove from cache
      delete this.jsonRestClients[wsConnection.getID()];
    }
  }

  public getChargingStationClient(tenantID: string, chargingStationID: string): JsonWSConnection {
    // Build ID
    const id = `${tenantID}~${chargingStationID}}`;
    // Charging Station exists?
    if (this.jsonChargingStationClients[id]) {
      // Return from the cache
      return this.jsonChargingStationClients[id].getChargingStationClient();
    }
    // Not found!
    return null;
  }
}

