import cluster from 'cluster';
import sanitize from 'express-sanitizer';
import morgan from 'morgan';
import path from 'path';
import socketio from 'socket.io';
import SourceMap from 'source-map-support';
import CentralRestServerAuthentication from './CentralRestServerAuthentication';
import CentralRestServerService from './CentralRestServerService';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import ErrorHandler from './ErrorHandler';
import expressTools from '../ExpressTools';
import Logging from '../../utils/Logging';
import SessionHashService from '../rest/service/SessionHashService';

SourceMap.install();

const MODULE_NAME = 'CentralRestServer';
export default class CentralRestServer {

  private static centralSystemRestConfig;
  private static restHttpServer;
  private static socketIO;
  private static currentNotifications = [];
  private chargingStationConfig: any;
  private express: any;

  // Create the rest server
  constructor(centralSystemRestConfig, chargingStationConfig) {
    // Keep params
    CentralRestServer.centralSystemRestConfig = centralSystemRestConfig;
    this.chargingStationConfig = chargingStationConfig;

    // Set
    Database.setChargingStationHeartbeatIntervalSecs(
      this.chargingStationConfig.heartbeatIntervalSecs);

    // Initialize express app
    this.express = expressTools.init('2mb');

    // FIXME?: Should be useless now that helmet() is mounted at the beginning
    // Mount express-sanitizer middleware
    this.express.use(sanitize());

    // Log to console
    if (CentralRestServer.centralSystemRestConfig.debug) {
      // Log
      this.express.use(
        morgan('combined', {
          'stream': {
            write: (message) => {
              // Log
              Logging.logDebug({
                tenantID: Constants.DEFAULT_TENANT,
                module: MODULE_NAME,
                method: 'constructor',
                action: 'HttpRequestLog',
                message: message
              });
            }
          }
        })
      );
    }

    // Authentication
    this.express.use(CentralRestServerAuthentication.initialize());

    // Auth services
    this.express.use('/client/auth', CentralRestServerAuthentication.authService);

    // Secured API
    this.express.use('/client/api', CentralRestServerAuthentication.authenticate(), CentralRestServerService.restServiceSecured);

    // Util API
    this.express.use('/client/util', CentralRestServerService.restServiceUtil);

    // Register error handler
    this.express.use(ErrorHandler.errorHandler);

    // Create HTTP server to serve the express app
    CentralRestServer.restHttpServer = expressTools.createHttpServer(CentralRestServer.centralSystemRestConfig, this.express);

    // Check if the front-end has to be served also
    const centralSystemConfig = Configuration.getCentralSystemFrontEndConfig();
    // Serve it?
    // TODO: Remove distEnabled support
    if (centralSystemConfig.distEnabled) {
      // Serve all the static files of the front-end
      // eslint-disable-next-line no-unused-vars
      this.express.get(/^\/(?!client\/)(.+)$/, function(req, res, next) {
        // Filter to not handle other server requests
        if (!res.headersSent) {
          // Not already processed: serve the file
          res.sendFile(path.join(__dirname, centralSystemConfig.distPath, req.sanitize(req.params[0])));
        }
      });
      // Default, serve the index.html
      // eslint-disable-next-line no-unused-vars
      this.express.get('/', function(req, res, next) {
        // Return the index.html
        res.sendFile(path.join(__dirname, centralSystemConfig.distPath, 'index.html'));
      });
    }
  }

  get httpServer() {
    return CentralRestServer.restHttpServer;
  }

  // TODO: never used?
  private static socketIOListenCb() {
    // Log
    const logMsg = `REST SocketIO Server listening on '${CentralRestServer.centralSystemRestConfig.protocol}://${CentralRestServer.restHttpServer.address().address}:${CentralRestServer.restHttpServer.address().port}'`;
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: MODULE_NAME,
      method: 'start', action: 'Startup',
      message: logMsg
    });
    // eslint-disable-next-line no-console
    console.log(logMsg + `${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}`);

    // Check and send notification
    setInterval(() => {
      // Send
      for (let i = CentralRestServer.currentNotifications.length - 1; i >= 0; i--) {
        // Notify all Web Sockets
        CentralRestServer.socketIO.to(CentralRestServer.currentNotifications[i].tenantID).emit(CentralRestServer.currentNotifications[i].entity, CentralRestServer.currentNotifications[i]);
        // Remove
        CentralRestServer.currentNotifications.splice(i, 1);
      }
    }, CentralRestServer.centralSystemRestConfig.webSocketNotificationIntervalSecs * 1000);
  }

  startSocketIO() {
    // Log
    const logMsg = 'Starting REST SocketIO Server...';
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: MODULE_NAME,
      method: 'start', action: 'Startup',
      message: logMsg
    });
    // eslint-disable-next-line no-console
    console.log(logMsg.replace('...', '') + ` ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}...`);
    // Init Socket IO
    CentralRestServer.socketIO = socketio(CentralRestServer.restHttpServer);
    // Handle Socket IO connection
    CentralRestServer.socketIO.on('connection', (socket) => {
      socket.join(socket.handshake.query.tenantID);
      // Handle Socket IO connection
      socket.on('disconnect', () => {
        // Nothing to do
      });
    });

    // Check and send notification
    setInterval(() => {
      // Send
      for (let i = CentralRestServer.currentNotifications.length - 1; i >= 0; i--) {
        // Notify all Web Sockets
        CentralRestServer.socketIO.to(CentralRestServer.currentNotifications[i].tenantID).emit(CentralRestServer.currentNotifications[i].entity, CentralRestServer.currentNotifications[i]);
        // Remove
        CentralRestServer.currentNotifications.splice(i, 1);
      }
    }, CentralRestServer.centralSystemRestConfig.webSocketNotificationIntervalSecs * 1000);
  }

  // Start the server
  start() {
    expressTools.startServer(CentralRestServer.centralSystemRestConfig, CentralRestServer.restHttpServer, 'REST', MODULE_NAME);
  }

  notifyUser(tenantID, action, data) {
    // On User change rebuild userHashID
    if (data && data.id) {
      SessionHashService.rebuildUserHashID(tenantID, data.id);
    }
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_USER,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_USERS
    });
  }

  notifyVehicle(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_VEHICLE,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_VEHICLES
    });
  }

  notifyVehicleManufacturer(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_VEHICLE_MANUFACTURER,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_VEHICLE_MANUFACTURERS
    });
  }

  notifyTenant(tenantID, action, data) {
    // On Tenant change rebuild tenantHashID
    if (data && data.id) {
      SessionHashService.rebuildTenantHashID(data.id);
    }
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_TENANT,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_TENANTS
    });
  }

  notifySite(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_SITE,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_SITES
    });
  }

  notifySiteArea(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_SITE_AREA,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_SITE_AREAS
    });
  }

  notifyCompany(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_COMPANY,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_COMPANIES
    });
  }

  notifyTransaction(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_TRANSACTION,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_TRANSACTIONS
    });
  }

  notifyChargingStation(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_CHARGING_STATION,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_CHARGING_STATIONS
    });
  }

  notifyLogging(tenantID, action) {
    // Add in buffer
    this.addNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Constants.ENTITY_LOGGINGS,
      'action': action
    });
  }

  addNotificationInBuffer(notification) {
    let dups = false;
    // Add in buffer
    for (let i = 0; i < CentralRestServer.currentNotifications.length; i++) {
      // Same Entity and Action?
      if (CentralRestServer.currentNotifications[i].tenantID === notification.tenantID &&
        CentralRestServer.currentNotifications[i].entity === notification.entity &&
        CentralRestServer.currentNotifications[i].action === notification.action) {
        // Yes
        dups = true;
        // Data provided: Check Id and Type
        if (CentralRestServer.currentNotifications[i].data &&
          (CentralRestServer.currentNotifications[i].data.id !== notification.data.id ||
            CentralRestServer.currentNotifications[i].data.type !== notification.data.type)) {
          dups = false;
        } else {
          break;
        }
      }
    }
    // Found dups?
    if (!dups) {
      // No: Add it
      CentralRestServer.currentNotifications.push(notification);
    }
  }
}
