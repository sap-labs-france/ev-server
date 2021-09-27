import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpTagRequest extends HttpByIDRequest {
  ID: string;
  WithUser: boolean;
}

export interface HttpTagByVisualIDRequest {
  VisualID: string;
  WithUser: boolean;
}

export interface HttpTagsRequest extends HttpDatabaseRequest {
  Search: string;
  UserID?: string;
  Issuer?: boolean;
  Active?: boolean;
  WithUser: boolean;
}

export interface HttpTagsDeleteByIDsRequest {
  tagsIDs: string[];
}

export interface HttpTagsDeleteByVisualIDsRequest {
  visualIDs: string[];
}

export interface HttpTagsDeleteByVisualIDRequest {
  visualID: string;
}
