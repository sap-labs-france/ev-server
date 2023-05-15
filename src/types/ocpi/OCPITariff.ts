export enum OCPITariffDimensionType {
  ENERGY = 'ENERGY',
  FLAT = 'FLAT',
  PARKING_TIME = 'PARKING_TIME',
  TIME = 'TIME',
}

export interface OCPIPriceComponent {
  type: OCPITariffDimensionType;
  price: number;
  step_size: number;
}

export interface OCPITariffElement {
  price_components: OCPIPriceComponent[];
}

export interface OCPITariff {
  id: string;
  currency: string;
  elements: OCPITariffElement[];
  last_updated: Date;
}
