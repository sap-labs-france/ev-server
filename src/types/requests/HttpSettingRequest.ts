import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpSettingRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpSettingByIdentifierRequest {
  Identifier: string;
}

export interface HttpSettingsRequest extends HttpDatabaseRequest {
  Identifier?: string;
}
