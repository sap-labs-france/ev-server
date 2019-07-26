import HttpByIDRequest from "./HttpByIDRequest";
import HttpDatabaseRequest from "./HttpDatabaseRequest";

export interface HttpSettingRequest extends HttpByIDRequest {}

export interface HttpSettingsRequest extends HttpDatabaseRequest {
  Identifier?: string;
}
