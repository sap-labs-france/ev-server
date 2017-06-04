var Logging = require('../../utils/Logging');
var Utils = require('../../utils/Utils');
var Authorization = require('node-authorization').Authorization;

module.exports = {
  ROLE_ADMIN: "A",
  ROLE_BASIC: "B",

  ENTITY_USER: "User",
  ENTITY_USERS: "Users",
  ENTITY_CHARGING_STATION: "ChargingStation",
  ENTITY_CHARGING_STATIONS: "ChargingStations",
  ENTITY_LOGGING: "Logging",

  ACTION_CREATE: "Create",
  ACTION_READ  : "Read",
  ACTION_UPDATE: "Update",
  ACTION_DELETE: "Delete",
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

  canPerformAction(loggedUser, entity, fieldNamesValues) {
    // Create Auth
    var auth = new Authorization(loggedUser.role, loggedUser.auths);
    // Switch on traces
    Authorization.switchTraceOn();
    // Check
    if(auth.check(entity, fieldNamesValues)) {
      // Authorized!
      return true;
    } else {
      return false;
    }
  }
}
