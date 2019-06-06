import Logging from '../../../utils/Logging';
import Database from '../../../utils/Database';
import AppError from '../../../exception/AppError';
import AppAuthError from '../../../exception/AppAuthError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Setting from '../../../entity/Setting';
import User from '../../../entity/User';
import SettingSecurity from './security/SettingSecurity';
export default class SettingService {
  static async handleDeleteSetting(action, req, res, next) {
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

  static async handleGetSetting(action, req, res, next) {
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
      const setting = await Setting.getSetting(req.user.tenantID, filteredRequest.ID);
      if (!setting) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Setting with ID '${filteredRequest.ID}' does not exist anymore`, 550,
          'SettingService', 'handleGetSetting', req.user);
      }
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

  static async handleGetSettings(action, req, res, next) {
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
      // Return
      res.json(settings);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleCreateSetting(action, req, res, next) {
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
      const filteredRequest = SettingSecurity.filterSettingCreateRequest(req.body, req.user);
      // Check Mandatory fields
      Setting.checkIfSettingValid(filteredRequest, req);

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

  static async handleUpdateSetting(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = SettingSecurity.filterSettingUpdateRequest(req.body, req.user);
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


