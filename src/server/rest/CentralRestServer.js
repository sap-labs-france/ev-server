const morgan = require('morgan');
const expressTools = require('../ExpressTools');
const sanitize = require('express-sanitizer');
const CentralRestServerAuthentication = require('./CentralRestServerAuthentication');
const CentralRestServerService = require('./CentralRestServerService');
const Database = require('../../utils/Database');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const ErrorHandler = require('./ErrorHandler');
const SessionHashService = require('../rest/service/SessionHashService');
require('source-map-support').install();

let _centralSystemRestConfig;
let _chargingStationConfig;
let _socketIO;
const _currentNotifications = [];
const MODULE_NAME = "CentralRestServer";

class CentralRestServer {
  // Create the rest server
  constructor(centralSystemRestConfig, chargingStationConfig) {
    // Keep params
    _centralSystemRestConfig = centralSystemRestConfig;
    _chargingStationConfig = chargingStationConfig;

    // Set
    Database.setChargingStationHeartbeatIntervalSecs(
      _chargingStationConfig.heartbeatIntervalSecs);

    // Initialize express app
    this._express = expressTools.expressCommonInit('2mb');

    // FIXME?: Should be useless now that helmet() is mounted at the beginning
    // Mount express-sanitizer middleware
    this._express.use(sanitize());

    // log to console
    if (_centralSystemRestConfig.debug) {
      // Log
      this._express.use(
        morgan('combined', {
          'stream': {
            write: (message) => {
              // Log
              Logging.logDebug({
                tenantID: Constants.DEFAULT_TENANT,
                module: MODULE_NAME,
                method: "constructor",
                action: "HttpRequestLog",
                message: message
              });
            }
          }
        })
      );
    }

    // Authentication
    this._express.use(CentralRestServerAuthentication.initialize());

    // Auth services
    this._express.use('/client/auth', CentralRestServerAuthentication.authService);

    // Secured API
    this._express.use('/client/api', CentralRestServerAuthentication.authenticate(), CentralRestServerService.restServiceSecured);

    // Util API
    this._express.use('/client/util', CentralRestServerService.restServiceUtil);

    // Register error handler
    this._express.use(ErrorHandler.errorHandler);
  }

  // Start the server
  start() {
    const server = expressTools.expressStartServer(_centralSystemRestConfig, "REST", MODULE_NAME, this._express,
      this._listenCb);

    // SocketIO enabled?
    if (_centralSystemRestConfig.socketIO) {
      // Init Socket IO
      _socketIO = require("socket.io")(server);
      // Handle Socket IO connection
      _socketIO.on("connection", (socket) => {
        socket.join(socket.handshake.query.tenantID);
        // Handle Socket IO connection
        socket.on("disconnect", () => {
          // Nothing to do
        });
      });
    }
  }

  // Listen callback
  _listenCb() {
    let host = _centralSystemRestConfig.host;
    if (!host)
      host = '::';
    // Check and send notification
    setInterval(() => {
      // Send
      for (let i = _currentNotifications.length - 1; i >= 0; i--) {
        // Notify the front-ends
        if (_socketIO) {
          _socketIO.to(_currentNotifications[i].tenantID).emit(_currentNotifications[i].entity, _currentNotifications[i]);
        }
        // Remove
        _currentNotifications.splice(i, 1);
      }
    }, _centralSystemRestConfig.webSocketNotificationIntervalSecs * 1000);
    // Log
    Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: MODULE_NAME,
      method: "start",
      action: "Startup",
      message: `REST Server listening on '${_centralSystemRestConfig.protocol}://${host}:${_centralSystemRestConfig.port}'`
    });
    // eslint-disable-next-line no-console
    console.log(`REST Server listening on '${_centralSystemRestConfig.protocol}://${host}:${_centralSystemRestConfig.port}'`);
  }

  notifyUser(tenantID, action, data) {
    // On User change rebuild userHashID
    if (data && data.id) {
      SessionHashService.rebuildUserHashID(tenantID, data.id);
    }
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_USER,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_USERS
    });
  }

  notifyVehicle(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_VEHICLE,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_VEHICLES
    });
  }

  notifyVehicleManufacturer(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_VEHICLE_MANUFACTURER,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_VEHICLE_MANUFACTURERS
    });
  }

  notifyTenant(tenantID, action, data) {
    // On Tenant change rebuild tenantHashID
    if (data && data.id) {
      SessionHashService.rebuildTenantHashID(data.id);
    }
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_TENANT,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_TENANTS
    });
  }

  notifySite(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_SITE,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_SITES
    });
  }

  notifySiteArea(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_SITE_AREA,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_SITE_AREAS
    });
  }

  notifyCompany(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_COMPANY,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_COMPANIES
    });
  }

  notifyTransaction(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_TRANSACTION,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_TRANSACTIONS
    });
  }

  notifyChargingStation(tenantID, action, data) {
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_CHARGING_STATION,
      "action": action,
      "data": data
    });
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_CHARGING_STATIONS
    });
  }

  notifyLogging(tenantID, action) {
    // Add in buffer
    this.addNotificationInBuffer({
      "tenantID": tenantID,
      "entity": Constants.ENTITY_LOGGINGS,
      "action": action
    });
  }

  addNotificationInBuffer(notification) {
    let dups = false;
    // Add in buffer
    for (let i = 0; i < _currentNotifications.length; i++) {
      // Same Entity and Action?
      if (_currentNotifications[i].tenantID === notification.tenantID &&
        _currentNotifications[i].entity === notification.entity &&
        _currentNotifications[i].action === notification.action) {
        // Yes
        dups = true;
        // Data provided: Check Id and Type
        if (_currentNotifications[i].data &&
          (_currentNotifications[i].data.id !== notification.data.id ||
            _currentNotifications[i].data.type !== notification.data.type)) {
          dups = false;
        } else {
          break;
        }
      }
    }
    // Found dups?
    if (!dups) {
      // No: Add it
      _currentNotifications.push(notification);
    }
  }
}

module.exports = CentralRestServer;
