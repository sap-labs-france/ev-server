/* eslint-disable @typescript-eslint/no-empty-interface */
import { ChargingStationTemplate } from '../ChargingStation';
import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpChargingStationTemplateGetRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpChargingStationTemplatesGetRequest extends HttpDatabaseRequest {
  Search?: string;
}

export interface HttpChargingStationTemplateUpdateRequest extends ChargingStationTemplate {
}

export interface HttpChargingStationTemplateCreateRequest extends ChargingStationTemplate {
}

export interface HttpChargingStationTemplateDeleteRequest extends HttpByIDRequest {
  ID: string;
}

export interface HttpChargingStationsTemplateResponse {
  count: number;
  result: ChargingStationTemplate[];
}
