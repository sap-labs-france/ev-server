var Logging = require('../../utils/Logging');
var Utils = require('../../utils/Utils');
var Authorization = require('node-authorization').Authorization;

module.exports = {
  ENTITY_USER: "User",
  ENTITY_CHARGING_STATION: "ChargingStation",

  ACTION_CREATE: "Create",
  ACTION_READ  : "Read",
  ACTION_UPDATE: "Update",
  ACTION_DELETE: "Delete",

  canCreateUser(loggedUser) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_USER,
      { "Action": this.ACTION_CREATE });
  },

  canReadUser(loggedUser, user) {
    // Check
    return this.canPerformAction(loggedUser, this.ENTITY_USER,
      { "Action": this.ACTION_READ, "UserID": user.id });
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
      console.log("GRANTED");
      return true;
    } else {
      console.log("NOT GRANTED");
      return false;
    }
  }
}
