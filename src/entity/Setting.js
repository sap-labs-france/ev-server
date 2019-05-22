const AbstractTenantEntity = require('./AbstractTenantEntity');
const Database = require('../utils/Database');
const Constants = require('../utils/Constants');
const AppError = require('../exception/AppError');
const SettingStorage = require('../storage/mongodb/SettingStorage');
const OCPIEndpointStorage = require('../storage/mongodb/OCPIEndpointStorage');
const User = require('./User');

class Setting extends AbstractTenantEntity {
  constructor(tenantID, setting) {
    super(tenantID);
    // Set it
    Database.updateSetting(setting, this._model);
  }

  getID() {
    return this._model.id;
  }

  /**
   * Identifier of the setting
   */
  getIdentifier() {
    return this._model.identifier;
  }

  setIdentifier(identifier) {
    this._model.identifier = identifier;
  }

  /**
   * get content
   */
  getContent() {
    return this._model.content;
  }

  setContent(content) {
    this._model.content = content;
  }

  getCreatedBy() {
    if (this._model.createdBy) {
      return new User(this.getTenantID(), this._model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this._model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this._model.createdOn;
  }

  setCreatedOn(createdOn) {
    this._model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this._model.lastChangedBy) {
      return new User(this.getTenantID(), this._model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this._model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this._model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this._model.lastChangedOn = lastChangedOn;
  }

  save() {
    return SettingStorage.saveSetting(this.getTenantID(), this.getModel());
  }

  async delete() {
    // Cleanup OCPI
    if (this.getIdentifier() === Constants.COMPONENTS.OCPI) {
      // Delete OCPI End Points
      await OCPIEndpointStorage.deleteOcpiEndpoints(this.getTenantID());
    }
    return SettingStorage.deleteSetting(this.getTenantID(), this.getID());
  }

  static createDefaultSettingContent(activeComponent, currentSettingContent) {
    switch (activeComponent.name) {
      // Pricing
      case Constants.COMPONENTS.PRICING:
        // Settings does not exists
        if (!currentSettingContent) {
          // Create default settings
          if (activeComponent.type === Constants.SETTING_PRICING_TYPE_SIMPLE) {
            return { "type": "simple", "simple": {} };
          } else if (activeComponent.type === Constants.SETTING_PRICING_TYPE_CONVERGENT_CHARGING) {
            return { "type": "convergentCharging", "convergentCharging": {} };
          }
        } else {
          // Changed?
          if (!currentSettingContent.hasOwnProperty(activeComponent.type)) {
            // Create new settings
            if (activeComponent.type === Constants.SETTING_PRICING_TYPE_SIMPLE) {
              return { "type": "simple", "simple": {} };
            } else if (activeComponent.type === Constants.SETTING_PRICING_TYPE_CONVERGENT_CHARGING) {
              return { "type": "convergentCharging", "convergentCharging": {} };
            }
          }
        }
        break;

      // Refund
      case Constants.COMPONENTS.REFUND:
        // Settings does not exists
        if (!currentSettingContent) {
          // Only Concur
          return { "type": "concur", "concur": {} };
        } else {
          // Changed?
          if (!currentSettingContent.hasOwnProperty(activeComponent.type)) {
            return { "type": "concur", "concur": {} };
          }
        }
        break;

      // Refund
      case Constants.COMPONENTS.OCPI:
        // Settings does not exists
        if (!currentSettingContent) {
          // Only Gireve
          return { "type": "gireve", "ocpi": {} };
        } else {
          // Changed?
          if (!currentSettingContent.hasOwnProperty(activeComponent.type)) {
            return { "type": "gireve", "ocpi": {} };
          }
        }
        break;

      // SAC
      case Constants.COMPONENTS.SAC:
        // Settings does not exists
        if (!currentSettingContent) {
          // Only SAP Analytics
          return { "type": "sac", "sac": {} };
        } else {
          // Changed?
          if (!currentSettingContent.hasOwnProperty(activeComponent.type)) {
            return { "type": "sac", "sac": {} };
          }
        }
        break;
    }
  }

  static checkIfSettingValid(request, httpRequest) {
    // Update model?
    if (httpRequest.method !== 'POST' && !request.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The Setting ID is mandatory`, 500,
        'Setting', 'checkIfSettingValid');
    }
  }

  static getSetting(tenantID, id) {
    return SettingStorage.getSetting(tenantID, id);
  }

  static getSettings(tenantID, params, limit, skip, sort) {
    return SettingStorage.getSettings(tenantID, params, limit, skip, sort);
  }

  static async getSettingByIdentifier(tenantID, identifier) {
    return await SettingStorage.getSettingByIdentifier(tenantID, identifier);
  }
}

module.exports = Setting;
