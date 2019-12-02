export interface ChargerManufacturerParameters {
  _id?: string;
  manufacturer: string;
  model: string;
  parameters: string[];
}

export interface ChargerSchedule {
  _id?: string;
  ChargerID: string;
  schedule: [];
}
