import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpAssignChargingStationToSiteAreaRequest {
  siteAreaID: string;
  chargingStationIDs: string[];
}

export interface HttpChargingStationsRequest extends HttpDatabaseRequest {
  Search?: string;
  WithNoSiteArea?: boolean;
  SiteID?: string;
  WithSite?: boolean; // TODO can we please remove this
  SiteAreaID?: string;
  IncludeDeleted?: boolean;
  ErrorType?: string;
}

export interface HttpChargingStationRequest {
  ChargeBoxID: string;
}

export interface HttpChargerManufacturerParametersRequest {
  manufacturer: string;
  model: string;
}

export interface HttpChargerScheduleRequest {
  chargerID: string;
  schedule?: [];
}

export interface HttpChargingStationSetMaxIntensitySocketRequest extends HttpChargingStationCommandRequest {
  maxIntensity?: number;
  args?: {maxIntensity: number};
}

export interface HttpChargingStationCommandRequest {
  chargeBoxID: string;
  args?: any;
}

export interface HttpIsAuthorizedRequest {
  Action: string;
  Arg1: any;
  Arg2: any;
  Arg3: any;
}
