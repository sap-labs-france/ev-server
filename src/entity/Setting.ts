import AppError from '../exception/AppError';
import Constants from '../utils/Constants';
import Database from '../utils/Database';
import OCPIEndpointStorage from '../storage/mongodb/OCPIEndpointStorage';
import SettingStorage from '../storage/mongodb/SettingStorage';
import TenantHolder from './TenantHolder';
import User from './User';

export default class Setting extends TenantHolder {
  private _model: any = {};

  constructor(tenantID: any, setting: any) {
    super(tenantID);
    Database.updateSetting(setting, this._model);
  }

  static createDefaultSettingContent(activeComponent, currentSettingContent) {
    switch (activeComponent.name) {
      // Pricing
      case Constants.COMPONENTS.PRICING:
        // Settings does not exists
        if (!currentSettingContent) {
          // Create default settings
          if (activeComponent.type === Constants.SETTING_PRICING_CONTENT_TYPE_SIMPLE) {
            return { 'type': 'simple', 'simple': {} };
          } else if (activeComponent.type === Constants.SETTING_PRICING_CONTENT_TYPE_CONVERGENT_CHARGING) {
            return { 'type': 'convergentCharging', 'convergentCharging': {} };
          }
        } else {
          // Changed?
          // eslint-disable-next-line no-lonely-if
          if (!currentSettingContent[activeComponent.type]) {
            // Create new settings
            if (activeComponent.type === Constants.SETTING_PRICING_CONTENT_TYPE_SIMPLE) {
              return { 'type': 'simple', 'simple': {} };
            } else if (activeComponent.type === Constants.SETTING_PRICING_CONTENT_TYPE_CONVERGENT_CHARGING) {
              return { 'type': 'convergentCharging', 'convergentCharging': {} };
            }
          }
        }
        break;

      // Refund
      case Constants.COMPONENTS.REFUND:
        // Settings does not exists
        if (!currentSettingContent) {
          // Only Concur
          return { 'type': 'concur', 'concur': {} };
        }
        // Changed?
        if (!currentSettingContent[activeComponent.type]) {
          return { 'type': 'concur', 'concur': {} };
        }

        break;

      // Refund
      case Constants.COMPONENTS.OCPI:
        // Settings does not exists
        if (!currentSettingContent) {
          // Only Gireve
          return { 'type': 'gireve', 'ocpi': {} };
        }
        // Changed?
        if (!currentSettingContent[activeComponent.type]) {
          return { 'type': 'gireve', 'ocpi': {} };
        }

        break;

      // SAC
      case Constants.COMPONENTS.ANALYTICS:
        // Settings does not exists
        if (!currentSettingContent) {
          // Only SAP Analytics
          return { 'type': 'sac', 'sac': {} };
        }
        // Changed?
        if (!currentSettingContent[activeComponent.type]) {
          return { 'type': 'sac', 'sac': {} };
        }

        break;
    }
  }

  static checkIfSettingValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Setting ID is mandatory', Constants.HTTP_GENERAL_ERROR,
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

  public getModel(): any {
    return this._model;
  }

  getID() {
    return this._model.id;
  }

  getIdentifier() {
    return this._model.identifier;
  }

  setIdentifier(identifier) {
    this._model.identifier = identifier;
  }

  getSensitiveData() {
    return this._model.sensitiveData;
  }

  setSensitiveData(data) {
    this._model.sensitiveData = data;
  }

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
}
