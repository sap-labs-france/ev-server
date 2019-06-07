import TenantHolder from './TenantHolder';
import Database from '../utils/Database';
import Constants from '../utils/Constants';
import AppError from '../exception/AppError';
import SettingStorage from '../storage/mongodb/SettingStorage';
import OCPIEndpointStorage from '../storage/mongodb/OCPIEndpointStorage';
import User from './User';

export default class Setting extends TenantHolder {

  private model: any = {};

  constructor(tenantID, setting) {
    super(tenantID);
    // Set it
    Database.updateSetting(setting, this.model);
  }

  public getModel(): any {
    return this.model;
  }

  getID() {
    return this.model.id;
  }

  /**
   * Identifier of the setting
   */
  getIdentifier() {
    return this.model.identifier;
  }

  setIdentifier(identifier) {
    this.model.identifier = identifier;
  }

  /**
   * get content
   */
  getContent() {
    return this.model.content;
  }

  setContent(content) {
    this.model.content = content;
  }

  getCreatedBy() {
    if (this.model.createdBy) {
      return new User(this.getTenantID(), this.model.createdBy);
    }
    return null;
  }

  setCreatedBy(user) {
    this.model.createdBy = user.getModel();
  }

  getCreatedOn() {
    return this.model.createdOn;
  }

  setCreatedOn(createdOn) {
    this.model.createdOn = createdOn;
  }

  getLastChangedBy() {
    if (this.model.lastChangedBy) {
      return new User(this.getTenantID(), this.model.lastChangedBy);
    }
    return null;
  }

  setLastChangedBy(user) {
    this.model.lastChangedBy = user.getModel();
  }

  getLastChangedOn() {
    return this.model.lastChangedOn;
  }

  setLastChangedOn(lastChangedOn) {
    this.model.lastChangedOn = lastChangedOn;
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
      case Constants.COMPONENTS.ANALYTICS:
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

  static checkIfSettingValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Setting ID is mandatory`, 500,
        'Setting', 'checkIfSettingValid',
        req.user.id);
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
