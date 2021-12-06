import { ChargePointStatus, OCPPFirmwareStatus, OCPPPhase, OCPPProtocol, OCPPVersion } from './ocpp/OCPPServer';

import { AuthorizationActions } from './Authorization';
import { ChargingRateUnitType } from './ChargingProfile';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { InactivityStatus } from './Transaction';
import { KeyValue } from './GlobalType';
import { OCPIEvse } from './ocpi/OCPIEvse';
import { OICPEvseDataRecord } from './oicp/OICPEvse';
import { OICPIdentification } from './oicp/OICPIdentification';
import Site from './Site';
import SiteArea from './SiteArea';
import User from './User';

export default interface ChargingStation extends CreatedUpdatedProps, AuthorizationActions {
  id?: string;
  templateHash?: string;
  templateHashCapabilities?: string;
  templateHashTechnical?: string;
  templateHashOcppStandard?: string;
  templateHashOcppVendor?: string;
  issuer: boolean;
  public: boolean;
  siteAreaID?: string;
  siteID?: string;
  companyID?: string;
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
  cloudHostIP?: string;
  cloudHostName?: string;
  lastSeen: Date;
  deleted: boolean;
  inactive: boolean;
  tokenID: string;
  forceInactive: boolean;
  manualConfiguration?: boolean;
  lastReboot: Date;
  chargingStationURL: string;
  maximumPower: number;
  voltage: Voltage;
  excludeFromSmartCharging?: boolean;
  powerLimitUnit: ChargingRateUnitType;
  coordinates: number[];
  chargePoints: ChargePoint[];
  connectors: Connector[];
  backupConnectors: Connector[];
  remoteAuthorizations: RemoteAuthorization[];
  currentIPAddress?: string|string[];
  siteArea?: SiteArea;
  site?: Site;
  capabilities?: ChargingStationCapabilities;
  ocppStandardParameters?: KeyValue[];
  ocppVendorParameters?: KeyValue[];
  distanceMeters?: number;
  ocpiData?: ChargingStationOcpiData;
  oicpData?: ChargingStationOicpData;
}

export interface ChargingStationOcpiData {
  evses?: OCPIEvse[];
}

export interface ChargingStationOicpData {
  evses?: OICPEvseDataRecord[];
}

export interface ChargingStationQRCode {
  tenantSubDomain?: string;
  tenantName?: string;
  endpoint?: ChargingStationEndpoint;
  chargingStationID?: string;
  connectorID?: number;
}

export enum ChargingStationEndpoint {
  SCP = 'scp',
  SCP_QA = 'scpqa',
  AWS = 'aws',
}

export interface TemplateUpdate {
  chargingStationUpdate: boolean;
  technicalUpdate: boolean;
  capabilitiesUpdate: boolean;
  ocppStandardUpdate: boolean;
  ocppVendorUpdate: boolean;
}

export interface TemplateUpdateResult {
  chargingStationUpdated: boolean;
  technicalUpdated: boolean;
  capabilitiesUpdated: boolean;
  ocppStandardUpdated: boolean;
  ocppVendorUpdated: boolean;
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
  BOOT_NOTIFICATION = 'BootNotification',
  AUTHORIZE = 'Authorize',
  HEARTBEAT = 'Heartbeat',
  DIAGNOSTICS_STATUS_NOTIFICATION = 'DiagnosticsStatusNotification',
  FIRMWARE_STATUS_NOTIFICATION = 'FirmwareStatusNotification',
  STATUS_NOTIFICATION = 'StatusNotification',
  START_TRANSACTION = 'StartTransaction',
  STOP_TRANSACTION = 'StopTransaction',
  METER_VALUES = 'MeterValues',
  DATA_TRANSFER = 'DataTransfer',
  RESERVE_NOW = 'ReserveNow',
  CANCEL_RESERVATION = 'CancelReservation',
}

export enum StaticLimitAmps {
  MIN_LIMIT_PER_PHASE = 6,
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
  currentUserID?: string;
  status: ChargePointStatus;
  errorCode?: string;
  info?: string;
  vendorErrorCode?: string;
  power?: number;
  type?: ConnectorType;
  voltage?: Voltage;
  amperage?: number;
  amperageLimit?: number;
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
  oicpIdentification?: OICPIdentification;
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
  VOLTAGE_400 = 400,
  VOLTAGE_230 = 230,
  VOLTAGE_110 = 110,
}

export interface ChargingStationTemplate {
  id?: string;
  qa?: boolean;
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
    parameters: Record<string, string>;
  }[];
  ocppVendorParameters: {
    supportedFirmwareVersions: string[];
    supportedOcppVersions: string[];
    parameters: Record<string, string>;
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
  supportFirmwareUpgrade?: boolean;
  supportSlave?: boolean;
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
  ARK_AC_EV_CHARGER = 'Ark AC EV Charger',
  ALFEN = 'Alfen BV',
  ALPITRONIC = 'alpitronic GmbH',
  BENDER = 'Bender GmbH Co. KG',
  CFOS = 'cFos',
  DBTCEV = 'DBT-CEV',
  EBEE = 'Ebee',
  ECOTAP = 'Ecotap',
  ENPLUS = 'EN+',
  EXADYS = 'EXADYS',
  EVBOX = 'EV-BOX',
  EVMETER = 'EV Meter',
  INNOGY = 'innogy',
  INGETEAM = 'INGETEAM',
  INGETEAM_ENERGY = 'INGETEAM ENERGY',
  EFACEC = 'pt.efacec',
  IES = 'IES',
  HDM = 'HDM',
  HAGER = 'Hager',
  WALLBOX_CHARGERS = 'Wall Box Chargers',
  SCHNEIDER = 'Schneider Electric',
  WEBASTO = 'Webasto',
  DELTA_ELECTRONICS = 'Delta Electronics',
  DELTA = 'DELTA',
  ABB = 'ABB',
  LEGRAND = 'Legrand',
  ATESS = 'ATESS',
  MENNEKES = 'MENNEKES',
  KEBA = 'Keba AG',
  SAP_LABS_FRANCE = 'SAP Labs France Caen',
  CIRCONTROL = 'CIRCONTROL',
  CIRCONTROL_BIS = 'Circontrol',
  JOINON = 'JOINON',
  JOINT = 'Joint',
  NEXANS = 'Nexans',
  AIXCHARGE = 'aixcharge',
  LAFON_TECHNOLOGIES = 'LAFON TECHNOLOGIES',
  TRITIUM = 'Tritium',
  GREEN_MOTION = 'Green Motion',
  G2_MOBILITY = 'com.g2mobility',
  MEAECN = 'MEAECN',
  KOSTAD = 'Kostad',
  KEMPOWER = 'Kempower',
  GROWATT = 'Growatt',
  SETEC = 'SETEC-POWER'
}
