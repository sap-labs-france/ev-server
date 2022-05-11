import { ChargingStationTemplate } from '../ChargingStation';
import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpChargingStationTemplatesRequest extends HttpDatabaseRequest {
  Search: string;
}

export interface HttpChargingStationTemplateRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpChargingStationsTemplateResponse {
  count: number;
  result: ChargingStationTemplate[];
}

