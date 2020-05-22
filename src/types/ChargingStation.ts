import { ChargePointStatus, OCPPFirmwareStatus, OCPPProtocol, OCPPVersion } from './ocpp/OCPPServer';

import CreatedUpdatedProps from './CreatedUpdatedProps';
import { InactivityStatus } from './Transaction';
import { KeyValue } from './GlobalType';
import { OCPIEvse } from './ocpi/OCPIEvse';
import SiteArea from './SiteArea';

export default interface ChargingStation extends CreatedUpdatedProps {
  id?: string;
  templateHash?: string;
  templateHashTechnical?: string;
  issuer: boolean;
  private: boolean;
  siteAreaID?: string;
  chargePointSerialNumber: string;
  chargePointModel: string;
  chargeBoxSerialNumber: string;
  chargePointVendor: string;
  iccid: string;
  imsi: string;
  meterType: string;
  firmwareVersion: string;
  firmwareUpdateStatus?: OCPPFirmwareStatus;
  meterSerialNumber: string;
  endpoint: string;
  ocppVersion: OCPPVersion;
  ocppProtocol: OCPPProtocol;
  cfApplicationIDAndInstanceIndex: string;
  lastHeartBeat: Date;
  deleted: boolean;
  inactive: boolean;
  lastReboot: Date;
  chargingStationURL: string;
  maximumPower: number;
  voltage: Voltage;
  excludeFromSmartCharging?: boolean;
  powerLimitUnit: PowerLimitUnits;
  coordinates: number[];
  chargePoints: ChargePoint[];
  connectors: Connector[];
  remoteAuthorizations: RemoteAuthorization[];
  currentIPAddress?: string;
  siteArea?: SiteArea;
  capabilities?: ChargingStationCapabilities;
  ocppStandardParameters?: KeyValue[];
  ocppVendorParameters?: KeyValue[];
  ocpiData?: {
    evse?: OCPIEvse;
  };
}

export interface OcppCommand {
  command: string;
  parameters: string[];
}

export enum Command {
  CLEAR_CACHE = 'ClearCache',
  GET_CONFIGURATION = 'GetConfiguration',
  CHANGE_CONFIGURATION = 'ChangeConfiguration',
  REMOTE_STOP_TRANSACTION = 'RemoteStopTransaction',
  REMOTE_START_TRANSACTION = 'RemoteStartTransaction',
  UNLOCK_CONNECTOR = 'UnlockConnector',
  RESET = 'Reset',
  SET_CHARGING_PROFILE = 'SetChargingProfile',
  CLEAR_CHARGING_PROFILE = 'ClearChargingProfile',
  GET_DIAGNOSTICS = 'GetDiagnostics',
  GET_COMPOSITE_SCHEDULE = 'GetCompositeSchedule',
  CHANGE_AVAILABILITY = 'ChangeAvailability',
  UPDATE_FIRMWARE = 'UpdateFirmware',
}

export enum PowerLimitUnits {
  WATT = 'W',
  AMPERE = 'A'
}

export enum StaticLimitAmps {
  MIN_LIMIT = 6,
}

export interface Connector {
  id?: string;
  connectorId: number;
  currentConsumption: number;
  currentStateOfCharge?: number;
  totalInactivitySecs?: number;
  totalConsumption?: number;
  status: ChargePointStatus;
  errorCode?: string;
  info?: string;
  vendorErrorCode?: string;
  power: number;
  type: ConnectorType;
  voltage?: Voltage;
  amperage?: number;
  amperageLimit?: number;
  activeTransactionID?: number;
  activeTransactionDate?: Date;
  activeTagID?: string;
  statusLastChangedOn?: Date;
  inactivityStatus?: InactivityStatus;
  numberOfConnectedPhase?: number;
  currentType?: CurrentType;
  chargePointID?: number;
}

export interface RemoteAuthorization {
  id: string;
  connectorId: number;
  tagId: string;
  timestamp: Date;
}

export interface ConnectorCurrentLimit {
  limitAmps: number;
  limitWatts: number;
  limitSource: ConnectorCurrentLimitSource;
}

export enum SiteAreaLimitSource {
  CHARGING_STATIONS = 'CS',
  SITE_AREA = 'SA',
}

export enum ConnectorCurrentLimitSource {
  CHARGING_PROFILE = 'CP',
  STATIC_LIMITATION = 'SL',
  CONNECTOR = 'CO'
}

export enum CurrentType {
  AC = 'AC',
  DC = 'DC'
}

export interface ChargePoint {
  currentType: CurrentType;
  voltage: Voltage;
  amperage: number;
  numberOfConnectedPhase: number;
  cannotChargeInParallel: boolean;
  sharePowerToAllConnectors: boolean;
  excludeFromPowerLimitation: boolean;
  power: number;
  efficiency: number;
  connectorIDs: number[];
}

export enum Voltage {
  VOLTAGE_230 = 230,
  VOLTAGE_110 = 110,
}

export interface ChargingStationTemplate {
  id?: string;
  hash?: string;
  hashTechnical?: string;
  chargePointVendor: string;
  extraFilters: {
    chargeBoxSerialNumber?: string;
  };
  technical: {
    maximumPower: number;
    voltage?: Voltage;
    powerLimitUnit: PowerLimitUnits;
    chargePoints?: ChargePoint[];
    connectors: {
      connectorId: number;
      type: ConnectorType;
      power?: number;
      amperage?: number;
      voltage?: Voltage;
      chargePointID?: number;
      currentType?: CurrentType;
      numberOfConnectedPhase?: number;
    }[];
  };
  capabilities: {
    supportedFirmwareVersions: string[];
    supportedOcppVersions: string[];
    capabilities: ChargingStationCapabilities;
  }[];
  ocppStandardParameters: {
    supportedOcppVersions: string[];
    parameters: object;
  }[];
  ocppVendorParameters: {
    supportedFirmwareVersions: string[];
    supportedOcppVersions: string[];
    parameters: object;
  }[];
}

export enum ConnectorType {
  TYPE_2 = 'T2',
  COMBO_CCS = 'CCS',
  CHADEMO = 'C',
  TYPE_1 = 'T1',
  TYPE_3C = 'T3C',
  TYPE_1_CCS = 'T1CCS',
  DOMESTIC = 'D',
  UNKNOWN = 'U',
}

export interface ChargingStationCapabilities {
  supportStaticLimitationForChargingStation: boolean;
  supportStaticLimitationPerConnector: boolean;
  supportChargingProfiles: boolean;
  supportCreditCard: boolean;
  supportRemoteStartStopTransaction: boolean;
  supportUnlockConnector: boolean;
  supportReservation: boolean;
  supportRFIDCard: boolean;
}

export interface ChargingStationOcppParameters {
  id: string;
  timestamp: Date;
  configuration: KeyValue[];
}

export interface OcppParameter {
  id: string;
  key: string;
  value: string;
  readonly: boolean;
}

export type OCPPParams = {
  siteName: string;
  siteAreaName: string;
  chargingStationName: string;
  params: OcppParameter[];
};

export enum ChargerVendor {
  EBEE = 'Bender GmbH Co. KG',
  SCHNEIDER = 'Schneider Electric',
  WEBASTO = 'Webasto',
  DELTA = 'DELTA',
  ABB = 'ABB',
}
