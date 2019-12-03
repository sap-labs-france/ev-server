export interface ChargerManufacturerParameters {
  _id?: string;
  manufacturer: string;
  model: string;
  firmware: string;
  parameters: LimiterKey[];
}

export interface LimiterKey{
  connectorID: number;
  key: string;
}

export interface LimiterKeyList{
  count: number;
  keys: LimiterKey[];
}

