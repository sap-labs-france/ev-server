const fs = require('fs');
const path = require('path');
const Utils = require('./Utils');
const _config = require('../config.json');
require('source-map-support').install();

module.exports = {
  // Read the config file
  getConfig() {
    return _config;
  },

  // Scheduler config
  getSchedulerConfig() {
    // Read conf
    return this.getConfig().Scheduler;
  },

  // Central System config
  getCentralSystemsConfig() {
    // Read conf
    return this.getConfig().CentralSystems;
  },

  // Notification config
  getNotificationConfig() {
    // Read conf
    return this.getConfig().Notification;
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
