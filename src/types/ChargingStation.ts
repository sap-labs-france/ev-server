import Connector from './Connector';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import SiteArea from './SiteArea';

export default interface ChargingStation extends CreatedUpdatedProps {
  id?: string;
  siteAreaID: string;
  chargePointSerialNumber: string;
  chargePointModel: string;
  chargeBoxSerialNumber: string;
  chargePointVendor: string;
  iccid: string;
  imsi: string;
  meterType: string;
  firmwareVersion: string;
  meterSerialNumber: string;
  endpoint: string;
  ocppVersion: string;
  ocppProtocol: string;
  cfApplicationIDAndInstanceIndex: string;
  lastHeartBeat: Date;
  deleted: boolean;
  inactive: boolean;
  lastReboot: Date;
  chargingStationURL: string;
  numberOfConnectedPhase: number;
  maximumPower: number;
  cannotChargeInParallel: boolean;
  powerLimitUnit: PowerLimitUnits;
  coordinates: number[];
  connectors: Connector[];
  errorCode?: string;
  currentIPAddress?: string;
  siteArea?: SiteArea;
  capabilities?: ChargingStationCapabilities;
}

export enum PowerLimitUnits {
  WATT = 'W',
  AMPERE = 'A'
}

export interface ChargingStationTemplate {
  id?: string;
  chargePointVendor: string;
  extraFilters: {
    chargeBoxSerialNumber?: string;
  };
  template: Partial<ChargingStation>;
}

export interface ChargingStationCapabilities {
  supportStaticLimitationForChargingStation: boolean;
  supportStaticLimitationPerConnector: boolean;
  supportChargePointMaxProfile: boolean;
  supportTxDefaultProfile: boolean;
  supportTxProfile: boolean;
}

export interface ChargingProfile {
  chargingProfileId: number;
  transactionId?: number;
  stackLevel: number;
  chargingProfilePurpose: ChargingProfilePurposeType;
  chargingProfileKind: ChargingProfileKindType;
  recurrencyKind: RecurrencyKindType;
  validFrom?: Date;
  validTo?: Date;
  chargingSchedule: ChargingSchedule;
}

export interface ChargingSchedule {
  duration?: number;
  startSchedule?: Date;
  chargingRateUnit: ChargingRateUnitType;
  chargingSchedulePeriod: ChargingSchedulePeriod[];
  minChargeRate?: number;
}

export interface ChargingSchedulePeriod {
  startPeriod: number;
  limit: number;
  numberPhases?: number;
}

export enum ChargingRateUnitType {
  WATT = 'W',
  AMPERE = 'A'
}

export enum ChargingProfileKindType{
  ABSOLUTE = 'Absolute',
  RECURRING = 'Recurring',
  RELATIVE = 'Relative'
}

export enum ChargingProfilePurposeType {
  CHARGE_POINT_MAX_PROFILE = 'ChargePointMaxProfile',
  TX_DEFAULT_PROFILE = 'TxDefaultProfile',
  TX_PROFILE = 'TxProfile'
}

export enum RecurrencyKindType {
  DAILY = 'Daily',
  WEEKLY = 'Weekly'
}
