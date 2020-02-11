import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpAssignChargingStationToSiteAreaRequest {
  siteAreaID: string;
  chargingStationIDs: string[];
}

export interface HttpChargingStationLimitPowerRequest {
  chargeBoxID: string;
  connectorId: number;
  ampLimitValue: number;
}

export interface HttpChargingProfilesRequest extends HttpDatabaseRequest {
  chargeBoxID: string;
  connectorID: number;
}

export interface HttpChargingStationsRequest extends HttpDatabaseRequest {
  Issuer?: boolean;
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

export interface HttpChargingStationConfigurationRequest {
  chargeBoxID: string;
  forceUpdateOCPPParamsFromTemplate: boolean;
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

export interface HttpChargingStationGetFirmwareRequest {
  FileName: string;
}
