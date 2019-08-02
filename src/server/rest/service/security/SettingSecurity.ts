import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import UtilsSecurity from './UtilsSecurity';

export default class SettingSecurity {
  // eslint-disable-next-line no-unused-vars
  static filterSettingDeleteRequest(request, loggedUser) {
    const filteredRequest: any = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterSettingRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.ID = sanitize(request.ID);
    filteredRequest.ContentFilter = UtilsSecurity.filterBoolean(request.ContentFilter);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterSettingsRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.Identifier = sanitize(request.Identifier);
    filteredRequest.ContentFilter = UtilsSecurity.filterBoolean(request.ContentFilter);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterSettingUpdateRequest(request, loggedUser) {
    // Set Setting
    const filteredRequest = SettingSecurity._filterSettingRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterSettingCreateRequest(request, loggedUser) {
    return SettingSecurity._filterSettingRequest(request, loggedUser);
  }

  // eslint-disable-next-line no-unused-vars
  static _filterSettingRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.identifier = sanitize(request.identifier);
    if ('sensitiveData' in request) {
      filteredRequest.sensitiveData = sanitize(request.sensitiveData);
    }
    filteredRequest.content = sanitize(request.content);
    return filteredRequest;
  }

  static filterSettingResponse(setting, loggedUser, contentFilter = false) {
    let filteredSetting;

    if (!setting) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadSetting(loggedUser, setting)) {
      filteredSetting = setting;
      if (contentFilter) {
        filteredSetting.content = SettingSecurity._filterAuthorizedSettingContent(loggedUser, setting);
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredSetting, setting, loggedUser);
    }
    return filteredSetting;
  }

  static filterSettingsResponse(settings, loggedUser, contentFilter = false) {
    const filteredSettings = [];

    if (!settings) {
      return null;
    }
    if (!Authorizations.canListSettings(loggedUser)) {
      return null;
    }
    for (const setting of settings) {
      // Filter
      const filteredSetting = SettingSecurity.filterSettingResponse(setting, loggedUser, contentFilter);
      // Ok?
      if (filteredSetting) {
        // Add
        filteredSettings.push(filteredSetting);
      }
    }
    return filteredSettings;
  }

  private static _filterAuthorizedSettingContent(loggedUser, setting) {
    if (!setting.content) {
      return null;
    }
    if (Authorizations.isSuperAdmin(loggedUser.role) || setting.identifier !== Constants.COMPONENTS.ANALYTICS) {
      return setting.content;
    }
    if (setting.content.links && Array.isArray(setting.content.links)) {
      const filteredLinks = setting.content.links.filter((link) => !link.role || link.role === '' ||
          (link.role && link.role.includes(loggedUser.role)));
      setting.content.links = filteredLinks;
    }
    return setting.content;
  }

}
