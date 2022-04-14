import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';
import ChargingStationTemplate from '../ChargingStationTemplate';

export interface HttpChargingStationsTemplateRequest extends HttpDatabaseRequest {
  Search: string;
  SiteAreaID: string;
}

export interface HttpChargingStationTemplateRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpChargingStationsTemplateResponse {
  count: number;
  result: ChargingStationTemplate[];
}

