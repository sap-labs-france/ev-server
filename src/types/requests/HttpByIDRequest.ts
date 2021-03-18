import { HttpDatabaseProjectRequest } from './HttpDatabaseRequest';

export default interface HttpByIDRequest extends HttpDatabaseProjectRequest {
  ID: string;
}

export interface HttpRestByIDRequest extends HttpDatabaseProjectRequest {
  id: string;
}
