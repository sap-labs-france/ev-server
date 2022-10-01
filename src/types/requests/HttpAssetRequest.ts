import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpAssetGetRequest extends HttpByIDRequest {
  ID: string;
  WithSiteArea?: boolean;
}

export interface HttpAssetDeleteRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpAssetsGetRequest extends HttpDatabaseRequest {
  Issuer?: boolean;
  Search?: string;
  SiteAreaID?: string;
  SiteID?: string;
  WithSite?: boolean;
  WithSiteArea?: boolean;
  WithNoSiteArea?: boolean;
  DynamicOnly?: boolean;
}

export interface HttpAssetsInErrorGetRequest extends HttpDatabaseRequest {
  Issuer?: boolean;
  Search: string;
  SiteAreaID?: string;
  SiteID?: string;
  WithSite?: boolean;
  WithSiteArea?: boolean;
  ErrorType?: string;
}

export interface HttpAssetConsumptionGetRequest {
  AssetID: string;
  StartDate: Date;
  EndDate: Date;
}

export interface HttpAssetImageGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpAssetCheckConnection extends HttpByIDRequest {
  ID: string;
}
