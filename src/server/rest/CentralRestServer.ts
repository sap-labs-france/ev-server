import { Action, Entity } from '../../types/Authorization';
import SingleChangeNotification, { NotificationData } from '../../types/SingleChangeNotification';
import express, { NextFunction, Request, Response } from 'express';

import AuthService from './v1/service/AuthService';
import CentralRestServerAuthentication from './CentralRestServerAuthentication';
import CentralRestServerService from './CentralRestServerService';
import CentralSystemRestServiceConfiguration from '../../types/configuration/CentralSystemRestServiceConfiguration';
import ChangeNotification from '../../types/ChangeNotification';
import ChargingStationConfiguration from '../../types/configuration/ChargingStationConfiguration';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import ExpressTools from '../ExpressTools';
import GlobalRouter from './v1/router/GlobalRouter';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import UserToken from '../../types/UserToken';
import Utils from '../../utils/Utils';
import cluster from 'cluster';
import http from 'http';
import sanitize from 'express-sanitizer';
import socketio from 'socket.io';
import socketioJwt from 'socketio-jwt';

const MODULE_NAME = 'CentralRestServer';

interface SocketIOJwt extends socketio.Socket {
  decoded_token: UserToken;
}

export default class CentralRestServer {
  private static centralSystemRestConfig: CentralSystemRestServiceConfiguration;
  private static restHttpServer: http.Server;
  private static socketIOServer: socketio.Server;
  private static changeNotifications: ChangeNotification[] = [];
  private static singleChangeNotifications: SingleChangeNotification[] = [];
  private chargingStationConfig: ChargingStationConfiguration;
  private expressApplication: express.Application;

  // Create the rest server
  constructor(centralSystemRestConfig: CentralSystemRestServiceConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    // Keep params
    CentralRestServer.centralSystemRestConfig = centralSystemRestConfig;
    this.chargingStationConfig = chargingStationConfig;
    // Initialize express app
    this.expressApplication = ExpressTools.initApplication('2mb', centralSystemRestConfig.debug);
    // Mount express-sanitizer middleware
    this.expressApplication.use(sanitize());
    // Authentication
    this.expressApplication.use(AuthService.initialize());
    // Routers
    this.expressApplication.use('/v1', new GlobalRouter().buildRoutes());
    // Auth services
    this.expressApplication.all('/client/auth/:action', CentralRestServerAuthentication.authService.bind(this));
    // Secured API
    this.expressApplication.all('/client/api/:action', AuthService.authenticate(), CentralRestServerService.restServiceSecured.bind(this));
    // Util API
    this.expressApplication.all('/client/util/:action', CentralRestServerService.restServiceUtil.bind(this));
    // Workaround URL encoding issue
    this.expressApplication.all('/client%2Futil%2FFirmwareDownload%3FFileName%3Dr7_update_3.3.0.12_d4.epk', async (req: Request, res: Response, next: NextFunction) => {
      req.url = decodeURIComponent(req.originalUrl);
      req.params.action = 'FirmwareDownload';
      req.query.FileName = 'r7_update_3.3.0.12_d4.epk';
      await CentralRestServerService.restServiceUtil(req, res, next);
    });
    // Post init
    ExpressTools.postInitApplication(this.expressApplication);
    // Create HTTP server to serve the express app
    CentralRestServer.restHttpServer = ExpressTools.createHttpServer(CentralRestServer.centralSystemRestConfig, this.expressApplication);
  }

  startSocketIO(): void {
    // Log
    const logMsg = `Starting REST SocketIO Server ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}...`;
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: MODULE_NAME, method: 'startSocketIO',
      action: ServerAction.STARTUP,
      message: logMsg
    });
    // eslint-disable-next-line no-console
    console.log(logMsg);
    // Init Socket IO
    CentralRestServer.socketIOServer = socketio(CentralRestServer.restHttpServer);
    CentralRestServer.socketIOServer.use((socket: socketio.Socket, next) => {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'startSocketIO',
        action: ServerAction.SOCKET_IO,
        message: 'SocketIO client is trying to connect from ' + socket.handshake.headers.origin,
        detailedMessages: { socketIOid: socket.id, socketIOHandshake: socket.handshake }
      });
      next();
    });
    CentralRestServer.socketIOServer.use(socketioJwt.authorize({
      secret: Configuration.getCentralSystemRestServiceConfig().userTokenKey,
      handshake: true,
      decodedPropertyName: 'decoded_token',
      // No client-side callback, terminate connection server-side
      callback: false
    }));
    // Handle Socket IO connection
    CentralRestServer.socketIOServer.on('connection', (socket: SocketIOJwt) => {
      const userToken: UserToken = socket.decoded_token;
      if (!userToken || !userToken.tenantID) {
        CentralRestServer.centralSystemRestConfig.debug && console.error('SocketIO client is trying to connect without token');
        Logging.logWarning({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'startSocketIO',
          action: ServerAction.SOCKET_IO,
          message: 'SocketIO client is trying to connect without token',
          detailedMessages: { socketIOid: socket.id, socketIOHandshake: socket.handshake }
        });
        socket.disconnect(true);
      } else {
        // Join Tenant Room
        socket.join(userToken.tenantID, (error) => {
          if (error) {
            CentralRestServer.centralSystemRestConfig.debug && console.error(`${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO error when trying to join a room: ${error}`);
            Logging.logError({
              tenantID: userToken.tenantID,
              module: MODULE_NAME, method: 'startSocketIO',
              action: ServerAction.SOCKET_IO,
              user: userToken.id,
              message: `${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO error when trying to join a room '${userToken.tenantID}': ${error}`,
              detailedMessages: { error, socketIOid: socket.id, socketIOHandshake: socket.handshake }
            });
            socket.disconnect(true);
          } else {
            CentralRestServer.centralSystemRestConfig.debug && console.log(`${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO client is connected on room '${userToken.tenantID}'`);
            Logging.logDebug({
              tenantID: userToken.tenantID,
              module: MODULE_NAME, method: 'startSocketIO',
              action: ServerAction.SOCKET_IO,
              user: userToken.id,
              message: `${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO client is connected on room '${userToken.tenantID}'`,
              detailedMessages: { socketIOid: socket.id, socketIOHandshake: socket.handshake }
            });
          }
        });
        // Handle Socket IO disconnection
        socket.on('disconnect', (reason: string) => {
          CentralRestServer.centralSystemRestConfig.debug && console.log(`${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO client is disconnected: ${reason}`);
          Logging.logDebug({
            tenantID: userToken.tenantID,
            module: MODULE_NAME, method: 'startSocketIO',
            action: ServerAction.SOCKET_IO,
            user: userToken.id,
            message: `${userToken.tenantName ? userToken.tenantName : userToken.tenantID} - ${Utils.buildUserFullName(userToken, false)} - SocketIO client is disconnected: ${reason}`,
            detailedMessages: { socketIOid: socket.id, socketIOHandshake: socket.handshake }
          });
        });
      }
    });

    // Check and send notification change for single record
    setInterval(() => {
      // Send
      while (!Utils.isEmptyArray(CentralRestServer.singleChangeNotifications)) {
        const notification = CentralRestServer.singleChangeNotifications.shift();
        CentralRestServer.socketIOServer.to(notification.tenantID).emit(notification.entity, notification);
      }
    }, CentralRestServer.centralSystemRestConfig.socketIOSingleNotificationIntervalSecs * 1000);

    // Check and send notification change for list
    setInterval(() => {
      // Send
      while (!Utils.isEmptyArray(CentralRestServer.changeNotifications)) {
        const notification = CentralRestServer.changeNotifications.shift();
        CentralRestServer.socketIOServer.to(notification.tenantID).emit(notification.entity, notification);
      }
    }, CentralRestServer.centralSystemRestConfig.socketIOListNotificationIntervalSecs * 1000);
  }

  // Start the server
  start(): void {
    ExpressTools.startServer(CentralRestServer.centralSystemRestConfig, CentralRestServer.restHttpServer, 'REST', MODULE_NAME);
  }

  public notifyUser(tenantID: string, action: Action, data: NotificationData): void {
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
      'entity': Entity.USERS,
      'action': action
    });
  }

  public notifyTag(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TAG,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.TAGS,
      'action': action
    });
  }

  public notifyTenant(tenantID: string, action: Action, data: NotificationData): void {
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
      'entity': Entity.TENANTS,
      'action': action
    });
  }

  public notifySite(tenantID: string, action: Action, data: NotificationData): void {
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
      'entity': Entity.SITES,
      'action': action
    });
  }

  public notifySiteArea(tenantID: string, action: Action, data: NotificationData): void {
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
      'entity': Entity.SITE_AREAS,
      'action': action
    });
  }

  public notifyCompany(tenantID: string, action: Action, data: NotificationData): void {
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
      'entity': Entity.COMPANIES,
      'action': action
    });
  }

  public notifyAsset(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.ASSET,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.ASSETS,
      'action': action
    });
  }

  public notifyTransaction(tenantID: string, action: Action, data: NotificationData): void {
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
      'entity': Entity.TRANSACTIONS,
      'action': action
    });
  }

  public notifyChargingStation(tenantID: string, action: Action, data: NotificationData): void {
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
      'entity': Entity.CHARGING_STATIONS,
      'action': action
    });
  }

  public notifyLogging(tenantID: string, action: Action): void {
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.LOGGINGS,
      'action': action
    });
  }

  public notifyRegistrationToken(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.REGISTRATION_TOKEN,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.REGISTRATION_TOKENS,
      'action': action
    });
  }

  public notifyInvoice(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.INVOICE,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.INVOICES,
      'action': action
    });
  }

  public notifyCar(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CAR,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CARS,
      'action': action
    });
  }

  public notifyCarCatalog(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CAR_CATALOG,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CAR_CATALOGS,
      'action': action
    });
  }

  public notifyChargingProfile(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CHARGING_PROFILE,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.CHARGING_PROFILES,
      'action': action
    });
  }

  public notifyOcpiEndpoint(tenantID: string, action: Action, data: NotificationData): void {
    // Add in buffer
    this.addSingleChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.OCPI_ENDPOINT,
      'action': action,
      'data': data
    });
    // Add in buffer
    this.addChangeNotificationInBuffer({
      'tenantID': tenantID,
      'entity': Entity.OCPI_ENDPOINTS,
      'action': action
    });
  }

  private addChangeNotificationInBuffer(notification: ChangeNotification) {
    let dups = false;
    if (this.hasSocketIOClients(notification.tenantID)) {
      // Handle dups in buffer
      for (const currentNotification of CentralRestServer.changeNotifications.slice().reverse()) {
        // Same notification
        if (JSON.stringify(currentNotification) === JSON.stringify(notification)) {
          dups = true;
          break;
        }
      }
      if (!dups) {
        // Add it
        CentralRestServer.changeNotifications.push(notification);
      }
    }
  }

  private addSingleChangeNotificationInBuffer(notification: SingleChangeNotification) {
    let dups = false;
    if (this.hasSocketIOClients(notification.tenantID)) {
      // Handle dups in buffer
      for (const currentNotification of CentralRestServer.singleChangeNotifications.slice().reverse()) {
        // Same notification
        if (JSON.stringify(currentNotification) === JSON.stringify(notification)) {
          dups = true;
          break;
        }
      }
      if (!dups) {
        // Add it
        CentralRestServer.singleChangeNotifications.push(notification);
      }
    }
  }

  private hasSocketIOClients(tenantID: string): boolean {
    if (CentralRestServer.socketIOServer.sockets.adapter.rooms[tenantID]) {
      return CentralRestServer.socketIOServer.sockets.adapter.rooms[tenantID].length > 0;
    }
    return false;
  }
}
