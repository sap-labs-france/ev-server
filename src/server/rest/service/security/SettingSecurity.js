const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');

class SettingSecurity {
  static filterSettingDeleteRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterSettingRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  static filterSettingsRequest(request, loggedUser) {
    const filteredRequest = {};
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

  static _filterSettingRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.identifier = sanitize(request.identifier);
    filteredRequest.content    = sanitize(request.content);
    return filteredRequest;
  }

  static filterSettingResponse(setting, loggedUser) {
    let filteredSetting;

    if (!setting) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadSetting(loggedUser, setting)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredSetting= setting;
      } else {
        // Set only necessary info
        return null;
      }

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

module.exports = SettingSecurity;
