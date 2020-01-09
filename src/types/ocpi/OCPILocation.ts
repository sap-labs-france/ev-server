import { OCPIEvse } from './OCPIEvse';

export interface OCPILocation {
  id: string;
  type: OCPILocationType;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  coordinates: {
    latitude: string;
    longitude: string;
  };
  evses: OCPIEvse[];
  last_updated: Date;
}

export enum OCPILocationType {
  ON_STREET = 'ON_STREET',
  PARKING_GARAGE = 'PARKING_GARAGE',
  UNDERGROUND_GARAGE = 'UNDERGROUND_GARAGE',
  PARKING_LOT = 'PARKING_LOT',
  OTHER = 'OTHER',
  UNKNOWN = 'UNKNOWN'
}

