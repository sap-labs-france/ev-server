import _ from 'lodash';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Database from '../../../utils/Database';
import Logging from '../../../utils/Logging';
import Setting from '../../../entity/Setting';
import SettingSecurity from './security/SettingSecurity';
import User from '../../../entity/User';

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
          'The Setting\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'SettingService', 'handleDeleteSetting', req.user);
      }
      // Get
      const setting = await Setting.getSetting(req.user.tenantID, filteredRequest.ID);
      if (!setting) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Setting with ID '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SettingService', 'handleDeleteSetting', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteSetting(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_SETTING,
          setting.getID(),
          Constants.HTTP_AUTH_ERROR,
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
          'The Setting\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'SettingService', 'handleGetSetting', req.user);
      }
      // Get it
      const setting = await Setting.getSetting(req.user.tenantID, filteredRequest.ID);
      if (!setting) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Setting with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SettingService', 'handleGetSetting', req.user);
      }
      // Process the sensitive data if any
      // Hash sensitive data before being sent to the front end
      Cypher.hashSensitiveDataInJSON(setting);
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
          Constants.HTTP_AUTH_ERROR,
          'SettingService', 'handleGetSettings',
          req.user);
      }
      // Filter
      const filteredRequest = SettingSecurity.filterSettingsRequest(req.query, req.user);
      // Get the all settings identifier
      const settings = await Setting.getSettings(req.user.tenantID,
        {
          'search': filteredRequest.Search,
          'identifier': filteredRequest.identifier
        },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      settings.result = settings.result.map((setting) => {
        return setting.getModel();
      });
      // Filter
      settings.result = SettingSecurity.filterSettingsResponse(
        settings.result, req.user);
      // Process the sensitive data if any
      settings.result.forEach((setting) => {
        // Hash sensitive data before being sent to the front end
        Cypher.hashSensitiveDataInJSON(setting);
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
          Constants.HTTP_AUTH_ERROR,
          'SettingService', 'handleCreateSetting',
          req.user);
      }
      // Filter
      const filteredRequest = SettingSecurity.filterSettingCreateRequest(req.body, req.user);
      // Check Mandatory fields
      Setting.checkIfSettingValid(filteredRequest, req);
      // Process the sensitive data if any
      Cypher.encryptSensitiveDataInJSON(filteredRequest);
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
      const filteredRequest = SettingSecurity.filterSettingUpdateRequest(req.body, req.user);
      // Get Setting
      const setting = await Setting.getSetting(req.user.tenantID, filteredRequest.id);
      if (!setting) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Setting with ID '${filteredRequest.id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'SettingService', 'handleUpdateSetting', req.user);
      }
      // Check Mandatory fields
      Setting.checkIfSettingValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateSetting(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SETTING,
          setting.getID(),
          Constants.HTTP_AUTH_ERROR,
          'SettingService', 'handleUpdateSetting',
          req.user);
      }
      // Process the sensitive data if any
      // Preprocess the data to take care of updated values
      if (filteredRequest.sensitiveData) {
        if (!Array.isArray(filteredRequest.sensitiveData)) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `The property 'sensitiveData' for Setting with ID '${filteredRequest.id}' is not an array`,
            Constants.HTTP_CYPHER_INVALID_SENSITIVE_DATA_ERROR,
            'SettingService', 'handleUpdateSetting', req.user);
        }
        // Process sensitive properties
        for (const property of filteredRequest.sensitiveData) {
          // Get the sensitive property from the request
          const valueInRequest = _.get(filteredRequest, property);
          if (valueInRequest && valueInRequest.length > 0) {
            // Get the sensitive property from the DB
            const valueInDb = _.get(setting.getModel(), property);
            if (valueInDb && valueInDb.length > 0) {
              const hashedValueInDB = Cypher.hash(valueInDb);
              if (valueInRequest !== hashedValueInDB) {
                // Yes: Encrypt
                _.set(filteredRequest, property, Cypher.encrypt(valueInRequest));
              } else {
                // No: Put back the encrypted value
                _.set(filteredRequest, property, valueInDb);
              }
            } else {
              // Value in db is empty then encrypt
              _.set(filteredRequest, property, Cypher.encrypt(valueInRequest));
            }
          }
        }
      }
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
