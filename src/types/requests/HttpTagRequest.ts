import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import Tag from '../Tag';

export interface HttpTagGetRequest extends HttpByIDRequest {
  ID: string;
  WithUser: boolean;
}

export interface HttpTagDeleteRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpTagByVisualIDGetRequest {
  VisualID: string;
  WithUser: boolean;
}

export interface HttpTagsGetRequest extends HttpDatabaseRequest {
  Search: string;
  UserID?: string;
  Issuer?: boolean;
  Active?: boolean;
  WithUser: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpTagUpdateRequest extends Tag {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpTagCreateRequest extends Tag {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpTagAssignRequest extends Tag {
}

export interface HttpTagsDeleteRequest {
  tagsIDs: string[];
}

export interface HttpTagsByVisualIDsUnassignRequest {
  visualIDs: string[];
}

export interface HttpTagByVisualIDUnassignRequest {
  visualID: string;
}
