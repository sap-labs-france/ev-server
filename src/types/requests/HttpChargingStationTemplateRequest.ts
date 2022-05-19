/* eslint-disable @typescript-eslint/no-empty-interface */
import { ChargingStationTemplate } from '../ChargingStation';

export interface HttpGetChargingStationTemplateRequest extends ChargingStationTemplate {
}

export interface HttpGetChargingStationTemplatesRequest extends ChargingStationTemplate {
  SortFields: string;
  OnlyRecordCount: boolean;
  Skip: number;
  Limit: number;
  Search?: string;
  Issuer?: boolean;
  WithSite?: boolean;
  WithLogo?: boolean;
  LocCoordinates?: number[];
  LocLongitude?: number;
  LocLatitude?: number;
  LocMaxDistanceMeters?: number;
}

export interface HttpUpdateChargingStationTemplateRequest extends ChargingStationTemplate {
}
export type HttpCreateChargingStationTemplateRequest = ChargingStationTemplate;

export type HttpDeleteChargingStationTemplateRequest = ChargingStationTemplate;


export interface HttpChargingStationsTemplateResponse {
  count: number;
  result: ChargingStationTemplate[];
}

