import { Voltage } from '../ChargingStation';

export type OCPIVoltage = Voltage;

export interface OCPIConnector {
  id: string;
  standard: OCPIConnectorType;
  format: OCPIConnectorFormat;
  power_type: OCPIPowerType;
  voltage: OCPIVoltage;
  amperage: number;
  tariff_id?: string;
  terms_and_conditions?: string;
  last_updated: Date;
}

export enum OCPIPowerType {
  AC_1_PHASE = 'AC_1_PHASE',
  AC_3_PHASE = 'AC_3_PHASE',
  DC = 'DC'
}

export enum OCPIConnectorType {
  CHADEMO = 'CHADEMO',
  DOMESTIC_A = 'DOMESTIC_A',
  DOMESTIC_B = 'DOMESTIC_B',
  DOMESTIC_C = 'DOMESTIC_C',
  DOMESTIC_D = 'DOMESTIC_D',
  DOMESTIC_E = 'DOMESTIC_E',
  DOMESTIC_F = 'DOMESTIC_F',
  DOMESTIC_G = 'DOMESTIC_G',
  DOMESTIC_H = 'DOMESTIC_H',
  DOMESTIC_I = 'DOMESTIC_I',
  DOMESTIC_J = 'DOMESTIC_J',
  DOMESTIC_K = 'DOMESTIC_K',
  DOMESTIC_L = 'DOMESTIC_L',
  IEC_60309_2_SINGLE_16 = 'IEC_60309_2_single_16',
  IEC_60309_2_THREE_16 = 'IEC_60309_2_three_16',
  IEC_60309_2_THREE_32 = 'IEC_60309_2_three_32',
  IEC_60309_2_THREE_64 = 'IEC_60309_2_three_64',
  IEC_62196_T1 = 'IEC_62196_T1',
  IEC_62196_T1_COMBO = 'IEC_62196_T1_COMBO',
  IEC_62196_T2 = 'IEC_62196_T2',
  IEC_62196_T2_COMBO = 'IEC_62196_T2_COMBO',
  IEC_62196_T3A = 'IEC_62196_T3A',
  IEC_62196_T3 = 'IEC_62196_T3',
  TESLA_R = 'TESLA_R',
  TESLA_S = 'TESLA_S'
}

export enum OCPIConnectorFormat {
  SOCKET = 'SOCKET',
  CABLE = 'CABLE'
}
