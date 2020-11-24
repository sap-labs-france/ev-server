import { ChargePointStatus, OCPPFirmwareStatus, OCPPPhase, OCPPProtocol, OCPPVersion } from './ocpp/OCPPServer';

import { ChargingRateUnitType } from './ChargingProfile';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { InactivityStatus } from './Transaction';
import { KeyValue } from './GlobalType';
import { OCPIEvse } from './ocpi/OCPIEvse';
import SiteArea from './SiteArea';
import User from './User';

export default interface ChargingStation extends CreatedUpdatedProps {
  id?: string;
  templateHash?: string;
  templateHashCapabilities?: string;
  templateHashTechnical?: string;
  templateHashOcppStandard?: string;
  templateHashOcppVendor?: string;
  issuer: boolean;
  public: boolean;
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
  lastSeen: Date;
  deleted: boolean;
  inactive: boolean;
  forceInactive: boolean;
  lastReboot: Date;
  chargingStationURL: string;
  maximumPower: number;
  voltage: Voltage;
  excludeFromSmartCharging?: boolean;
  powerLimitUnit: ChargingRateUnitType;
  coordinates: number[];
  chargePoints: ChargePoint[];
  connectors: Connector[];
  remoteAuthorizations: RemoteAuthorization[];
  currentIPAddress?: string|string[];
  siteArea?: SiteArea;
  capabilities?: ChargingStationCapabilities;
  ocppStandardParameters?: KeyValue[];
  ocppVendorParameters?: KeyValue[];
  distanceMeters?: number;
  ocpiData?: {
    evse?: OCPIEvse;
  };
}

export interface TemplateUpdateResult {
  technicalUpdated: boolean;
  capabilitiesUpdated: boolean;
  ocppUpdated: boolean;
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

export enum StaticLimitAmps {
  MIN_LIMIT_PER_PHASE = 13,
}

export interface Connector {
  id?: string;
  connectorId: number;
  currentInstantWatts?: number;
  currentStateOfCharge?: number;
  currentTotalConsumptionWh?: number;
  currentTotalInactivitySecs?: number;
  currentInactivityStatus?: InactivityStatus;
  currentTransactionID?: number;
  currentTransactionDate?: Date;
  currentTagID?: string;
  status: ChargePointStatus;
  errorCode?: string;
  info?: string;
  vendorErrorCode?: string;
  power?: number;
  type?: ConnectorType;
  voltage?: Voltage;
  amperage?: number;
  amperageLimit?: number;
  userID?: string;
  user?: User;
  statusLastChangedOn?: Date;
  numberOfConnectedPhase?: number;
  currentType?: CurrentType;
  chargePointID?: number;
  phaseAssignmentToGrid?: PhaseAssignmentToGrid;
}

export interface PhaseAssignmentToGrid {
  csPhaseL1: OCPPPhase.L1 | OCPPPhase.L2 | OCPPPhase.L3;
  csPhaseL2: OCPPPhase.L1 | OCPPPhase.L2 | OCPPPhase.L3;
  csPhaseL3: OCPPPhase.L1 | OCPPPhase.L2 | OCPPPhase.L3;
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
  chargePointID: number;
  currentType: CurrentType;
  voltage: Voltage;
  amperage: number;
  numberOfConnectedPhase: number;
  cannotChargeInParallel: boolean;
  sharePowerToAllConnectors: boolean;
  excludeFromPowerLimitation: boolean;
  ocppParamForPowerLimitation: string;
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
  hashCapabilities?: string;
  hashOcppStandard?: string;
  hashOcppVendor?: string;
  chargePointVendor: string;
  extraFilters: {
    chargeBoxSerialNumber?: string;
  };
  technical: {
    maximumPower: number;
    voltage?: Voltage;
    powerLimitUnit: ChargingRateUnitType;
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
    supportedFirmwareVersions: string[];
    supportedOcppVersions: string[];
    parameters: any;
  }[];
  ocppVendorParameters: {
    supportedFirmwareVersions: string[];
    supportedOcppVersions: string[];
    parameters: any;
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
  supportStaticLimitation: boolean;
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
  configuration: OcppParameter[];
}

export interface OcppParameter {
  key: string;
  value?: string;
  readonly: boolean;
  custom?: boolean;
}

export type OCPPParams = {
  siteName: string;
  siteAreaName: string;
  chargingStationName: string;
  params: OcppParameter[];
};

export enum ChargerVendor {
  BENDER = 'Bender GmbH Co. KG',
  EBEE = 'Ebee',
  SCHNEIDER = 'Schneider Electric',
  WEBASTO = 'Webasto',
  DELTA = 'DELTA',
  ABB = 'ABB',
  LEGRAND = 'Legrand',
  ATESS = 'ATESS',
  MENNEKES = 'MENNEKES',
}
