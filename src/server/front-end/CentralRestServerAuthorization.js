const Logging = require('../../utils/Logging');
const Configuration = require('../../utils/Configuration');
const Authorization = require('node-authorization').Authorization;

let _configuration;

module.exports = {
  ROLE_ADMIN: "A",
  ROLE_BASIC: "B",
  ROLE_DEMO: "D",
  ROLE_CORPORATE: "C",

  ENTITY_USER: "User",
  ENTITY_USERS: "Users",
  ENTITY_CHARGING_STATION: "ChargingStation",
  ENTITY_CHARGING_STATIONS: "ChargingStations",
  ENTITY_LOGGING: "Logging",

  ACTION_CREATE: "Create",
  ACTION_READ  : "Read",
  ACTION_UPDATE: "Update",
  ACTION_DELETE: "Delete",
  ACTION_LOGOUT: "Logout",
  ACTION_LIST: "List",
  ACTION_RESET: "Reset",
  ACTION_CLEAR_CACHE: "ClearCache",
  ACTION_STOP_TRANSACTION: "StopTransaction",
  ACTION_UNLOCK_CONNECTOR: "UnlockConnector",
  ACTION_GET_CONFIGURATION: "GetConfiguration",

  canListLogging(loggedUser) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_LOGGING,
      { "Action": this.ACTION_LIST });
  },

  canListChargingStations(loggedUser) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATIONS,
      { "Action": this.ACTION_LIST });
  },

  canPerformActionOnChargingStation(loggedUser, chargingStation, action) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
      { "Action": action });
  },

  canReadChargingStation(loggedUser, chargingStation) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
      { "Action": this.ACTION_READ });
  },

  canListUsers(loggedUser) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_USERS,
      { "Action": this.ACTION_LIST });
  },

  canReadUser(loggedUser, user) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_USER,
      { "Action": this.ACTION_READ, "UserID": user.id });
  },

  canLogoutUser(loggedUser, user) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_USER,
      { "Action": this.ACTION_LOGOUT, "UserID": user.id });
  },

  canCreateUser(loggedUser) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_USER,
      { "Action": this.ACTION_CREATE });
  },

  canUpdateUser(loggedUser, user) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_USER,
      { "Action": this.ACTION_UPDATE, "UserID": user.id });
  },

  canDeleteUser(loggedUser, user) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_USER,
      { "Action": this.ACTION_DELETE, "UserID": user.id });
  },

  canDeleteChargingStation(loggedUser, chargingStation) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_CHARGING_STATION,
      { "Action": this.ACTION_DELETE });
  },

  isAdmin(loggedUser) {
    return loggedUser.role === this.ROLE_ADMIN;
  },

  isUser(loggedUser) {
    return loggedUser.role === this.ROLE_USER;
  },

  isCorporate(loggedUser) {
    return loggedUser.role === this.ROLE_CORPORATE;
  },

  isDemo(loggedUser) {
    return loggedUser.role === this.ROLE_DEMO;
  },

  getConfiguration() {
    if(!_configuration) {
      // Load it
      _configuration = Configuration.getAuthorizationConfig();
    }
    return _configuration;
  },

  canPerformAction(loggedUser, entity, fieldNamesValues) {
    // Set debug mode?
    if (this.getConfiguration().debug) {
      // Switch on traces
      Authorization.switchTraceOn();
    }
    // Create Auth
    var auth = new Authorization(loggedUser.role, loggedUser.auths);
    // Check
    if(auth.check(entity, fieldNamesValues)) {
      // Authorized!
      return true;
    } else {
      return false;
    }
  }
};
