import CentralRestServerAuthentication from './CentralRestServerAuthentication';
import CentralRestServerService from './CentralRestServerService';
import ChangeNotification from '../../types/ChangeNotification';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import { Entity } from '../../types/Authorization';
import Logging from '../../utils/Logging';
import SessionHashService from '../rest/service/SessionHashService';

import cluster from 'cluster';
import express from 'express';
import expressTools from '../ExpressTools';
import morgan from 'morgan';
import sanitize from 'express-sanitizer';
import socketio from 'socket.io';
import socketioJwt from 'socketio-jwt';
import UserToken from '../../types/UserToken';
import SingleChangeNotification from '../../types/SingleChangeNotification';

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
    this.express.use('/client/auth', CentralRestServerAuthentication.authService);

    // Secured API
    this.express.use('/client/api', CentralRestServerAuthentication.authenticate(), CentralRestServerService.restServiceSecured);

    // Util API
    this.express.use('/client/util', CentralRestServerService.restServiceUtil);

    // Create HTTP server to serve the express app
    CentralRestServer.restHttpServer = expressTools.createHttpServer(CentralRestServer.centralSystemRestConfig, this.express);

    // Check if the front-end has to be served also
    const centralSystemConfig = Configuration.getCentralSystemFrontEndConfig();
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
      if (socket.request.headers.cookie) {
        return next();
      }
      next(new Error('Authentication error'));
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
        socket.close();
      } else {
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
    }, CentralRestServer.centralSystemRestConfig.webSocketSingleNotificationIntervalSecs * 1000);

    // Check and send notification change for list
    setInterval(() => {
      // Send
      while (CentralRestServer.changeNotifications.length > 0) {
        const notification = CentralRestServer.changeNotifications.shift();
        CentralRestServer.socketIO.to(notification.tenantID).emit(notification.entity, notification);
      }
    }, CentralRestServer.centralSystemRestConfig.webSocketListNotificationIntervalSecs * 1000);
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

  notifyVehicle(tenantID: string, action: string, data) {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.VEHICLE,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.VEHICLES
    });
  }

  notifyVehicleManufacturer(tenantID: string, action: string, data) {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.VEHICLE_MANUFACTURER,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.VEHICLE_MANUFACTURERS
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
