/* eslint-disable @typescript-eslint/no-empty-interface */
import { ChargingStationTemplate } from '../ChargingStation';

export interface HttpGetChargingStationTemplateRequest extends ChargingStationTemplate {
}

export interface HttpGetChargingStationTemplatesRequest extends ChargingStationTemplate {
  SortFields: string;
  OnlyRecordCount: boolean;
  Skip: number;
  Limit: number;
  WithUser?: boolean;
  Search?: string;
  Issuer?: boolean;
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

