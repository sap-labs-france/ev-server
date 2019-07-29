import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpSettingRequest, HttpSettingsRequest } from '../../../../types/requests/HttpSettingRequest';
import Setting from '../../../../types/Setting';
import UserToken from '../../../../types/UserToken';

export default class SettingSecurity {

  public static filterSettingDeleteRequest(request: HttpByIDRequest): string {
    return sanitize(request.ID);
  }

  public static filterSettingRequest(request: HttpSettingRequest): HttpSettingRequest {
    return { ID: sanitize(request.ID) };
  }

  public static filterSettingsRequest(request: HttpSettingsRequest): HttpSettingsRequest {
    const filteredRequest: HttpSettingsRequest = {} as HttpSettingsRequest;
    filteredRequest.Identifier = sanitize(request.Identifier);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSettingUpdateRequest(request: Partial<Setting>): Partial<Setting> {
    const filteredRequest = SettingSecurity._filterSettingRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterSettingCreateRequest(request: Partial<Setting>): Partial<Setting> {
    return SettingSecurity._filterSettingRequest(request);
  }

  public static _filterSettingRequest(request: Partial<Setting>): Partial<Setting> {
    return {
      identifier: sanitize(request.identifier),
      content: sanitize(request.content),
      sensitiveData: request.sensitiveData?sanitize(request.sensitiveData):[]
    };
  }

  public static filterSettingResponse(setting: Setting, loggedUser: UserToken) {
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
      if(! filteredSetting.sensitiveData) {
        filteredSetting.sensitiveData = [];
      }
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

  public static filterSettingsResponse(settings, loggedUser: UserToken) {
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

