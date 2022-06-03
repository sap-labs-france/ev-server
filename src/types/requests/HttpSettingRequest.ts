import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import { SettingDB } from '../Setting';

export interface HttpSettingGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpSettingDeleteRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpSettingByIdentifierGetRequest {
  Identifier: string;
}

export interface HttpSettingsGetRequest extends HttpDatabaseRequest {
  Identifier?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpSettingUpdateRequest extends SettingDB {
}
