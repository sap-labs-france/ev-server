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
  ChargeBoxID?: string;
  SiteAreaID?: string;
  IncludeDeleted?: boolean;
  ErrorType?:'missingSettings'|'connectionBroken'|'connectorError'|'missingSiteArea'|'all';
}

export interface HttpChargingStationSetMaxIntensitySocketRequest {
  chargeBoxID: string;
  maxIntensity;
}
