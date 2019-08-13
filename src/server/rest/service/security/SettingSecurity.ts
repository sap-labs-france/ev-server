import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpSettingRequest, HttpSettingsRequest } from '../../../../types/requests/HttpSettingRequest';
import Setting from '../../../../types/Setting';
import UserToken from '../../../../types/UserToken';
import Constants from '../../../../utils/Constants';
import UtilsSecurity from './UtilsSecurity';

export default class SettingSecurity {

  public static filterSettingRequestByID(request: HttpByIDRequest): string {
    return sanitize(request.ID);
  }

  public static filterSettingRequest(request: HttpSettingRequest): HttpSettingRequest {
    return {
      ID: sanitize(request.ID),
      ContentFilter: UtilsSecurity.filterBoolean(request.ContentFilter)
    };
  }


  public static filterSettingsRequest(request: HttpSettingsRequest): HttpSettingsRequest {
    const filteredRequest: HttpSettingsRequest = {} as HttpSettingsRequest;
    filteredRequest.Identifier = sanitize(request.Identifier);
    filteredRequest.ContentFilter = UtilsSecurity.filterBoolean(request.ContentFilter);
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
      sensitiveData: request.sensitiveData ? sanitize(request.sensitiveData) : []
    };
  }

  public static filterSettingResponse(setting: Setting, loggedUser: UserToken, contentFilter = false) {
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

  public static filterSettingsResponse(settings, loggedUser: UserToken, contentFilter = false) {
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

  private static _filterAuthorizedSettingContent(loggedUser: UserToken, setting: Setting) {
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
