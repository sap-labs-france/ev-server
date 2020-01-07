import CreatedUpdatedProps from './CreatedUpdatedProps';
import SiteArea from './SiteArea';
import { InactivityStatusLevel, InactivityStatus } from './Transaction';
import { KeyValue } from './GlobalType';

export default interface ChargingStation extends CreatedUpdatedProps {
  id?: string;
  issuer: boolean;
  siteAreaID?: string;
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
  maximumPower: number;
  cannotChargeInParallel: boolean;
  powerLimitUnit: PowerLimitUnits;
  coordinates: number[];
  connectors: Connector[];
  errorCode?: string;
  currentIPAddress?: string;
  siteArea?: SiteArea;
  capabilities?: ChargingStationCapabilities;
  ocppAdvancedCommands?: OcppAdvancedCommands[];
  ocppStandardParameters?: KeyValue[];
  ocppVendorParameters?: KeyValue[];
  currentType: ChargingStationCurrentType;
}

export enum ChargingStationCurrentType {
  AC = 'AC',
  DC = 'DC',
  AC_DC = 'AC/DC',
}

export interface OcppCommand {
  command: string,
  parameters: string[]
}

export interface OcppAdvancedCommands {
  command: string|OcppCommand;
}

export enum PowerLimitUnits {
  WATT = 'W',
  AMPERE = 'A'
}

export interface Connector {
  name: string;
  connectorId: number;
  currentConsumption: number;
  currentStateOfCharge?: number;
  totalInactivitySecs?: number;
  totalConsumption?: number;
  status: string;
  errorCode?: string;
  info?: string;
  vendorErrorCode?: string;
  power: number;
  type: string;
  voltage?: number;
  amperage?: number;
  activeTransactionID?: number;
  activeTransactionDate?: Date;
  activeTagID?: string;
  statusLastChangedOn?: Date;
  inactivityStatusLevel?: InactivityStatusLevel; // TODO: Use in the mobile app, to be removed in V1.3
  inactivityStatus?: InactivityStatus;
  numberOfConnectedPhase?: number;
  currentType?: ConnectorCurrentType;
}

export enum ConnectorCurrentType {
  AC = 'AC',
  DC = 'DC'
}

export interface ChargingStationTemplate {
  id?: string;
  chargePointVendor: string;
  extraFilters: {
    chargeBoxSerialNumber?: string;
  };
  template: {
    cannotChargeInParallel: boolean;
    currentType: ChargingStationCurrentType;
    connectors: Connector[];
    capabilities: {
      supportedFirmwareVersions: string[];
      supportedOcppVersions: string[];
      capabilities: ChargingStationCapabilities;
    }[]
    ocppAdvancedCommands: {
      supportedFirmwareVersions: string[];
      supportedOcppVersions: string[];
      commands: OcppAdvancedCommands[];
    }[]
    ocppStandardParameters: {
      supportedOcppVersions: string[];
      parameters: object;
    }[]
    ocppVendorParameters: {
      supportedFirmwareVersions: string[];
      supportedOcppVersions: string[];
      parameters: object;
    }[]
  };
}

export interface ChargingStationCapabilities {
  supportStaticLimitationForChargingStation?: boolean;
  supportStaticLimitationPerConnector?: boolean;
  supportChargingProfiles?: boolean;
}

export interface ChargingProfile {
  chargingProfileId: Number;
  transactionId?: Number;
  stackLevel: Number;
  chargingProfilePurpose: ChargingProfilePurposeType;
  chargingProfileKind: ChargingProfileKindType;
  recurrencyKind: RecurrencyKindType;
  validFrom?: Date;
  validTo?: Date;
  chargingSchedule: ChargingSchedule
}

export interface ChargingSchedule {
  duration?: Number;
  startSchedule?: Date;
  chargingRateUnit: ChargingRateUnitType;
  chargingSchedulePeriod: ChargingSchedulePeriod[]
  minChargeRate?: Number;
}

export interface ChargingSchedulePeriod {
  startPeriod: Number;
  limit: Number;
  numberPhases?: Number;
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

export interface ChargingStationConfiguration {
  id: string;
  timestamp: Date;
  configuration: KeyValue[];
}
