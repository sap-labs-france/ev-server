export interface OCPIChargingPeriod {
  start_date_time: Date;
  dimensions: OCPICdrDimension[];
}

export interface OCPICdrDimension {
  type: CdrDimensionType;
  volume: number;
}

export enum CdrDimensionType {
  ENERGY = 'ENERGY',
  FLAT = 'FLAT',
  MAX_CURRENT = 'MAX_CURRENT',
  MIN_CURRENT = 'MIN_CURRENT',
  PARKING_TIME = 'PARKING_TIME',
  TIME = 'TIME',
}
