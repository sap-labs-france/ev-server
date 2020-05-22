import { ConnectorType, CurrentType } from '../ChargingStation';

import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpAssignChargingStationToSiteAreaRequest {
  siteAreaID: string;
  chargingStationIDs: string[];
}

export interface HttpTriggerSmartChargingRequest {
  siteAreaID: string;
}

export interface HttpChargingStationLimitPowerRequest {
  chargeBoxID: string;
  connectorId: number;
  ampLimitValue: number;
  forceUpdateChargingPlan: boolean;
}

export interface HttpChargingProfilesRequest extends HttpDatabaseRequest {
  ChargeBoxID: string;
  ConnectorID: number;
}

export interface HttpChargingStationsRequest extends HttpDatabaseRequest {
  Issuer?: boolean;
  Search?: string;
  WithNoSiteArea?: boolean;
  ConnectorStatus?: string;
  ConnectorType?: string;
  SiteID?: string;
  WithSite?: boolean;
  SiteAreaID?: string;
  IncludeDeleted?: boolean;
  ErrorType?: string;
}

export interface HttpChargingStationParamsUpdateRequest {
  id: string;
  chargingStationURL: string;
  maximumPower: number;
  private: boolean;
  excludeFromSmartCharging: boolean;
  siteAreaID: string;
  coordinates: number[];
  connectors: {
    connectorId: number;
    type: ConnectorType;
    power: number;
    amperage: number;
    voltage: number;
    currentType: CurrentType;
    numberOfConnectedPhase: number;
  }[];
}

export interface HttpChargingStationRequest {
  ChargeBoxID: string;
}

export interface HttpChargingStationOcppParametersRequest {
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
