/* eslint-disable @typescript-eslint/no-empty-interface */
import { ChargingStationTemplate } from '../ChargingStation';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpGetChargingStationTemplateRequest extends ChargingStationTemplate {
}

export interface HttpGetChargingStationTemplatesRequest extends HttpDatabaseRequest {
  Search?: string;
}

export interface HttpUpdateChargingStationTemplateRequest extends ChargingStationTemplate {
}

export interface HttpCreateChargingStationTemplateRequest extends ChargingStationTemplate {
}

export interface HttpDeleteChargingStationTemplateRequest extends ChargingStationTemplate {
}

export interface HttpChargingStationsTemplateResponse {
  count: number;
  result: ChargingStationTemplate[];
}

