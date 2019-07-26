import HttpDatabaseRequest from "./HttpDatabaseRequest";
import SiteUsersHashIDsTask from "../../migration/tasks/SiteUsersHashIDsTask";

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
  ErrorType?:'missingSettings'|'connectionBroken'|'connectorError'|'missingSiteArea'|'all';
}

export interface HttpChargingStationRequest {
  ChargeBoxID: string;
}

export interface HttpChargingStationSetMaxIntensitySocketRequest extends HttpChargingStationCommandRequest {
  maxIntensity?: number;
  args?: {maxIntensity: number};
}

export interface HttpChargingStationCommandRequest {
  chargeBoxID: string;
  args?: any;
}
