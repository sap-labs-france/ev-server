var fs = require('fs');
var path = require('path');
var Users = require('./Users');
var Configuration = require('./Configuration');

let _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();

module.exports = {
  // Read the user from file
  getUsers() {
    // Read conf
    return JSON.parse(fs.readFileSync(path.join(__dirname, "../users.json"), "UTF-8"));
  },

  // Save the users in file
  saveUsers(users) {
    // Save
    fs.writeFileSync(path.join(__dirname, `../users-sav-${new Date().getMilliseconds()}.json`), JSON.stringify(users, null, ' '), 'UTF-8');
  },

  getRandomInt() {
    return Math.floor((Math.random() * 1000000000) + 1);
  },

  buildEvseURL() {
    return _centralSystemFrontEndConfig.protocol + "://" +
      _centralSystemFrontEndConfig.host + ":" +
      _centralSystemFrontEndConfig.port;
  },

  buildEvseChargingStationURL(chargingStation) {
    let _evseBaseURL = this.buildEvseURL();
    // Add : https://localhost:8080/#/pages/chargers/charger/REE001
    return _evseBaseURL + "/#/pages/chargers/charger/" + chargingStation.getChargeBoxIdentity();
  }
};
