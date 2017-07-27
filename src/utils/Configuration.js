var fs = require('fs');
var path = require('path');
const Utils = require('./Utils');

var _config;

module.exports = {
  // Read the config file
  getConfig() {
    // Read conf
    if (!_config) {
      _config = JSON.parse(fs.readFileSync(path.join(__dirname,"../config.json"), "UTF-8"));
    }
    return _config;
  },

  // Read the config file
  saveConfig(config) {
    // Save
    fs.writeFileSync(path.join(__dirname, `../config.json`), JSON.stringify(config, null, ' '), 'UTF-8');
    // Clear config
    _config = null;
  },

  // Central System config
  getCentralSystemsConfig() {
    // Read conf
    return this.getConfig().CentralSystems;
  },

  // Authorization config
  getAuthorizationConfig() {
    // Read conf
    return this.getConfig().Authorization;
  },

  // Central System REST config
  getCentralSystemRestServiceConfig() {
    // Read conf
    return this.getConfig().CentralSystemRestService;
  },

  // Central System Front-End config
  getCentralSystemFrontEndConfig() {
    // Read conf
    return this.getConfig().CentralSystemFrontEnd;
  },

  // Email config
  getEmailConfig() {
    // Read conf
    return this.getConfig().Email;
  },

  // Advanced config
  getAdvancedConfig() {
    // Read conf
    return this.getConfig().Advanced;
  },

  saveAdvancedConfig(advancedConfig) {
    // Read conf
    let config = this.getConfig();
    // Set
    config.Advanced = advancedConfig;
    // Save Config
    this.saveConfig(config);
  },

  // Locale config
  getLocalesConfig() {
    // Read conf
    return this.getConfig().Locales;
  },

  // DB config
  getStorageConfig() {
    // Read conf
    return this.getConfig().Storage;
  },

  // Central System config
  getChargingStationConfig() {
    // Read conf
    return this.getConfig().ChargingStation;
  }
};
