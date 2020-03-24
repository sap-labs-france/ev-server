import { NextFunction, Request, Response } from 'express';
import CentralRestServerAuthentication from './CentralRestServerAuthentication';
import CentralRestServerService from './CentralRestServerService';
import ChangeNotification from '../../types/ChangeNotification';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import { Entity } from '../../types/Authorization';
import Logging from '../../utils/Logging';
import SessionHashService from '../rest/service/SessionHashService';
import SingleChangeNotification from '../../types/SingleChangeNotification';
import UserToken from '../../types/UserToken';

import cluster from 'cluster';
import express from 'express';
import expressTools from '../ExpressTools';
import morgan from 'morgan';
import sanitize from 'express-sanitizer';
import socketio from 'socket.io';
import socketioJwt from 'socketio-jwt';
import util from 'util';

const MODULE_NAME = 'CentralRestServer';
export default class CentralRestServer {

  private static centralSystemRestConfig;
  private static restHttpServer;
  private static socketIO;
  private static changeNotifications: ChangeNotification[] = [];
  private static singleChangeNotifications: SingleChangeNotification[] = [];
  private chargingStationConfig: any;
  private express: express.Application;

  // Create the rest server
  constructor(centralSystemRestConfig, chargingStationConfig) {
    // Keep params
    CentralRestServer.centralSystemRestConfig = centralSystemRestConfig;
    this.chargingStationConfig = chargingStationConfig;

    // Initialize express app
    this.express = expressTools.init('2mb');

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
    this.express.all('/client/auth/:action', CentralRestServerAuthentication.authService);

    // Secured API
    this.express.all('/client/api/:action', CentralRestServerAuthentication.authenticate(), CentralRestServerService.restServiceSecured);

    // Util API
    this.express.all('/client/util/:action', CentralRestServerService.restServiceUtil);
    // Workaround URL encoding issue
    this.express.all('/client%2Futil%2FFirmwareDownload%3FFileName%3Dr7_update_3.3.0.10_d4.epk', async (req: Request, res: Response, next: NextFunction) => {
      req.url = decodeURIComponent(req.originalUrl);
      req.params.action = 'FirmwareDownload';
      req.query.FileName = 'r7_update_3.3.0.10_d4.epk';
      await CentralRestServerService.restServiceUtil(req, res, next);
    });

    // Catchall for util with logging
    this.express.all(['/client/util/*', '/client%2Futil%2F*'], (req: Request, res: Response) => {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: 'constructor', action: 'Express catchall',
        message: `Unhandled URL ${req.method} request (original URL ${req.originalUrl})`,
        detailedMessages: 'Request: ' + util.inspect(req)
      });
      res.sendStatus(404);
    });

    // Create HTTP server to serve the express app
    CentralRestServer.restHttpServer = expressTools.createHttpServer(CentralRestServer.centralSystemRestConfig, this.express);
  }

  get httpServer() {
    return CentralRestServer.restHttpServer;
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
    CentralRestServer.socketIO.use((socket, next) => {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: 'start', action: 'Startup',
        message: 'Socket is trying to connect from ' + socket.handshake.headers.origin,
        detailedMessages: { socketHandshake: socket.handshake }
      });
      next();
    });
    CentralRestServer.socketIO.use(socketioJwt.authorize({
      secret: Configuration.getCentralSystemRestServiceConfig().userTokenKey,
      handshake: true,
      decodedPropertyName: 'decoded_token',
    }));
    // Handle Socket IO connection
    CentralRestServer.socketIO.on('connection', (socket) => {
      const userToken: UserToken = socket.decoded_token;
      if (!userToken || !userToken.tenantID) {
        Logging.logWarning({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME,
          method: 'start', action: 'Startup',
          message: 'Socket is trying to connect without token',
          detailedMessages: { socketHandshake: socket.handshake }
        });
        socket.disconnect(true);
      } else {
        Logging.logDebug({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME,
          method: 'start', action: 'Startup',
          message: 'Socket is connected to tenant ' + userToken.tenantID,
          detailedMessages: { socketHandshake: socket.handshake }
        });
        socket.join(userToken.tenantID);
        // Handle Socket IO connection
        socket.on('disconnect', () => {
          // Nothing to do
        });
      }
    });

    // Check and send notification change for single record
    setInterval(() => {
      // Send
      while (CentralRestServer.singleChangeNotifications.length > 0) {
        const notification = CentralRestServer.singleChangeNotifications.shift();
        CentralRestServer.socketIO.to(notification.tenantID).emit(notification.entity, notification);
      }
    }, CentralRestServer.centralSystemRestConfig.socketIOSingleNotificationIntervalSecs * 1000);

    // Check and send notification change for list
    setInterval(() => {
      // Send
      while (CentralRestServer.changeNotifications.length > 0) {
        const notification = CentralRestServer.changeNotifications.shift();
        CentralRestServer.socketIO.to(notification.tenantID).emit(notification.entity, notification);
      }
    }, CentralRestServer.centralSystemRestConfig.socketIOListNotificationIntervalSecs * 1000);
  }

  // Start the server
  start() {
    expressTools.startServer(CentralRestServer.centralSystemRestConfig, CentralRestServer.restHttpServer, 'REST', MODULE_NAME);
  }

  notifyUser(tenantID: string, action: string, data) {
    // On User change rebuild userHashID
    if (data && data.id) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      SessionHashService.rebuildUserHashID(tenantID, data.id);
    }
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.USER,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.USERS
    });
  }

  notifyTenant(tenantID: string, action: string, data) {
    // On Tenant change rebuild tenantHashID
    if (data && data.id) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      SessionHashService.rebuildTenantHashID(data.id);
    }
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TENANT,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TENANTS
    });
  }

  notifySite(tenantID: string, action: string, data) {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.SITE,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.SITES
    });
  }

  notifySiteArea(tenantID: string, action: string, data) {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.SITE_AREA,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.SITE_AREAS
    });
  }

  notifyCompany(tenantID: string, action: string, data) {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.COMPANY,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.COMPANIES
    });
  }

  notifyBuilding(tenantID: string, action: string, data) {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.BUILDING,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.BUILDINGS
    });
  }

  notifyTransaction(tenantID: string, action: string, data) {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TRANSACTION,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TRANSACTIONS
    });
  }

  notifyChargingStation(tenantID: string, action: string, data) {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CHARGING_STATION,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CHARGING_STATIONS
    });
  }

  notifyLogging(tenantID: string, action: string) {
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.LOGGINGS,
      'action': action
    });
  }

  private addChangeNotificationInBuffer(notification: ChangeNotification) {
    let dups = false;
    // Add in buffer
    for (const currentNotification of CentralRestServer.changeNotifications) {
      // Same Entity and Action?
      if (currentNotification.tenantID === notification.tenantID &&
        currentNotification.entity === notification.entity &&
        currentNotification.action === notification.action) {
        // Yes
        dups = true;
        break;
      }
    }
    // Found dups?
    if (!dups) {
      // No: Add it
      CentralRestServer.changeNotifications.push(notification);
    }
  }

  private addSingleChangeNotificationInBuffer(notification: SingleChangeNotification) {
    let dups = false;
    // Add in buffer
    for (const currentNotification of CentralRestServer.singleChangeNotifications) {
      // Same Entity and Action?
      if (currentNotification.tenantID === notification.tenantID &&
        currentNotification.entity === notification.entity &&
        currentNotification.action === notification.action &&
        currentNotification.data.id === notification.data.id &&
        currentNotification.data.type === notification.data.type
      ) {
        // Yes
        dups = true;
        break;
      }
    }
    // Found dups?
    if (!dups) {
      // No: Add it
      CentralRestServer.singleChangeNotifications.push(notification);
    }
  }
}
