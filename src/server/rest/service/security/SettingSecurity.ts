import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
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
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterSettingsRequest(request, loggedUser) {
    const filteredRequest: any = {};
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.Identifier = sanitize(request.Identifier);
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

  static filterSettingResponse(setting, loggedUser) {
    let filteredSetting;

    if (!setting) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadSetting(loggedUser)) {
      // Admin?
      // if (Authorizations.isAdmin(loggedUser)) {
      // Yes: set all params
      filteredSetting = setting;
      // } else {
      //   // Set only necessary info
      //   return null;
      // }

      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredSetting, setting, loggedUser);
    }
    return filteredSetting;
  }

  static filterSettingsResponse(settings, loggedUser) {
    const filteredSettings = [];

    if (!settings) {
      return null;
    }
    if (!Authorizations.canListSettings(loggedUser)) {
      return null;
    }
    for (const setting of settings) {
      // Filter
      const filteredSetting = SettingSecurity.filterSettingResponse(setting, loggedUser);
      // Ok?
      if (filteredSetting) {
        // Add
        filteredSettings.push(filteredSetting);
      }
    }
    return filteredSettings;
  }
}


