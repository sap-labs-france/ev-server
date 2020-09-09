import { ConnectorType, CurrentType, PhaseAssignmentToGrid } from '../ChargingStation';

import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpTriggerSmartChargingRequest {
  siteAreaID: string;
}

export interface HttpChargingStationLimitPowerRequest {
  chargeBoxID: string;
  chargePointID: number;
  ampLimitValue: number;
  forceUpdateChargingPlan: boolean;
}

export interface HttpChargingProfilesRequest extends HttpDatabaseRequest {
  Search?: string;
  ChargeBoxID?: string;
  ConnectorID?: number;
  WithChargingStation?: boolean;
  WithSiteArea?: boolean;
  SiteID?: string;
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
  LocCoordinates?: number[];
  LocMaxDistanceMeters?: number;
}

export interface HttpChargingStationParamsUpdateRequest {
  id: string;
  chargingStationURL: string;
  maximumPower: number;
  public: boolean;
  excludeFromSmartCharging: boolean;
  forceInactive: boolean;
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
    phaseAssignmentToGrid: PhaseAssignmentToGrid;
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
