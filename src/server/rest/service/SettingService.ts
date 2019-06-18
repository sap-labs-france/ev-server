import Logging from '../../../utils/Logging';
import Database from '../../../utils/Database';
import AppError from '../../../exception/AppError';
import AppAuthError from '../../../exception/AppAuthError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Setting from '../../../entity/Setting';
import User from '../../../entity/User';
import SettingSecurity from './security/SettingSecurity';
import Cipher from '../../../utils/Cipher';
import _ from 'lodash';

export default class SettingService {
  public static async handleDeleteSetting(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = SettingSecurity.filterSettingDeleteRequest(req.query, req.user);
      // Check Mandatory fields
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Setting's ID must be provided`, 500,
          'SettingService', 'handleDeleteSetting', req.user);
      }
      // Get
      const setting = await Setting.getSetting(req.user.tenantID, filteredRequest.ID);
      if (!setting) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Setting with ID '${filteredRequest.ID}' does not exist`, 550,
          'SettingService', 'handleDeleteSetting', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteSetting(req.user, setting.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_SETTING,
          setting.getID(),
          560,
          'SettingService', 'handleDeleteSetting',
          req.user);
      }
      // Delete
      await setting.delete();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SettingService', method: 'handleDeleteSetting',
        message: `Setting '${setting.getIdentifier()}' has been deleted successfully`,
        action: action, detailedMessages: setting
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleGetSetting(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = SettingSecurity.filterSettingRequest(req.query, req.user);
      // ID is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Setting's ID must be provided`, 500,
          'SettingService', 'handleGetSetting', req.user);
      }
      // Get it
      let setting = await Setting.getSetting(req.user.tenantID, filteredRequest.ID);
      if (!setting) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Setting with ID '${filteredRequest.ID}' does not exist anymore`, 550,
          'SettingService', 'handleGetSetting', req.user);
      }
      // Process the sensitive data if any
      // Hash sensitive data before being sent to the front end
      Cipher.hashJSON(setting);
      // Return
      res.json(
        // Filter
        SettingSecurity.filterSettingResponse(
          setting.getModel(), req.user)
      );
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleGetSettings(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListSettings(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_SETTINGS,
          null,
          560,
          'SettingService', 'handleGetSettings',
          req.user);
      }
      // Filter
      const filteredRequest = SettingSecurity.filterSettingsRequest(req.query, req.user);
      // Get the all settings identifier
      const settings = await Setting.getSettings(req.user.tenantID,
        {
          'search': filteredRequest.Search,
          'identifier': filteredRequest.Identifier
        },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      settings.result = settings.result.map((setting) => setting.getModel());
      // Filter
      settings.result = SettingSecurity.filterSettingsResponse(
        settings.result, req.user);
      // Process the sensitive data if any
      settings.result.forEach((setting) => {
        // Hash sensitive data before being sent to the front end
        Cipher.hashJSON(setting);
      });
      // Return
      res.json(settings);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleCreateSetting(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canCreateSetting(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_SETTING,
          null,
          560,
          'SettingService', 'handleCreateSetting',
          req.user);
      }
      // Filter
      let filteredRequest = SettingSecurity.filterSettingCreateRequest(req.body, req.user);
      // Check Mandatory fields
      Setting.checkIfSettingValid(filteredRequest, req);
      // Process the sensitive data if any
      Cipher.encryptJSON(filteredRequest);
      // Create setting
      const setting = new Setting(req.user.tenantID, filteredRequest);
      // Update timestamp
      setting.setCreatedBy(new User(req.user.tenantID, { 'id': req.user.id }));
      setting.setCreatedOn(new Date());
      // Save Setting
      const newSetting = await setting.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SettingService', method: 'handleCreateSetting',
        message: `Setting '${newSetting.getIdentifier()}' has been created successfully`,
        action: action, detailedMessages: newSetting
      });
      // Ok
      res.json(Object.assign({ id: newSetting.getID() }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleUpdateSetting(action, req, res, next) {
    try {
      // Filter
      let filteredRequest = SettingSecurity.filterSettingUpdateRequest(req.body, req.user);
      // Get Setting
      const setting = await Setting.getSetting(req.user.tenantID, filteredRequest.id);
      if (!setting) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Setting with ID '${filteredRequest.id}' does not exist anymore`, 550,
          'SettingService', 'handleUpdateSetting', req.user);
      }
      // Check Mandatory fields
      Setting.checkIfSettingValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateSetting(req.user, setting.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SETTING,
          setting.getID(),
          560,
          'SettingService', 'handleUpdateSetting',
          req.user);
      }
      // Process the sensitive data if any
      if(filteredRequest.sensitiveData){
        if(!Array.isArray(filteredRequest.sensitiveData)) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `The property sensitiveData for Setting with ID '${filteredRequest.id}' is not an array`, 550,
            'SettingService', 'handleGetSetting', req.user);
        }
        // Preprocess the data to detect updated values
        filteredRequest.sensitiveData.forEach((property: string) => {
          // Check that the property does exist in the JSON coming from the dashboard
          // Otherwise skip to the next property
          if(_.has(filteredRequest,property)) {
            const valueInRequest = _.get(filteredRequest, property);
            // Check that the property has a value in the JSON coming from the dashboard
            // Otherwise skip to the next property and do not update the db
            if(valueInRequest && valueInRequest.length > 0) { // if the value in the JSON coming from the dashboard is either undefined, null or empty then skip to the next property
              // Check that the same property does exist in the db and has a value
              // If the db value (hashed) equals the dashboard value then the value has not been changed
              // and therefore must be decrypted as it will be automatically encrypted again in the next step
              if(_.has(setting.getModel(),property)) {
                const valueInDb = _.get(setting.getModel(), property);
                if(valueInDb && (valueInRequest === Cipher.hashString(valueInDb))) {
                  _.set(filteredRequest, property, Cipher.decryptString(valueInDb));
                }
              }
            }
          }
        });
      }
      // Encrypt sensitive data before being saved to the db
      Cipher.encryptJSON(filteredRequest);
      // Update
      Database.updateSetting(filteredRequest, setting.getModel());
      // Update timestamp
      setting.setLastChangedBy(new User(req.user.tenantID, { 'id': req.user.id }));
      setting.setLastChangedOn(new Date());
      // Update Setting
      const updatedSetting = await setting.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SettingService', method: 'handleUpdateSetting',
        message: `Setting '${updatedSetting.getIdentifier()}' has been updated successfully`,
        action: action, detailedMessages: updatedSetting
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}
