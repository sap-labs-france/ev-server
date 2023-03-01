import User from '../User';

export interface OCPPBootNotificationRequest {
  chargeBoxSerialNumber?: string;
  chargePointModel: string;
  chargePointSerialNumber?: string;
  chargePointVendor: string;
  firmwareVersion?: string;
  iccid?: string;
  imsi?: string;
  meterSerialNumber?: string;
  meterType?: string;
}

export interface OCPPBootNotificationRequestExtended extends OCPPBootNotificationRequest {
  endpoint: string | string[];
  id: string;
  chargeBoxID: string;
  currentIPAddress: string | string[];
  ocppProtocol: OCPPProtocol;
  ocppVersion: OCPPVersion;
  timestamp: Date;
  lastReboot: Date;
}

export interface OCPPBootNotificationResponse {
  status: RegistrationStatus;
  currentTime: string;
  interval: number;
}

export enum OCPPProtocol {
  SOAP = 'soap',
  JSON = 'json',
}

export enum OCPPVersion {
  VERSION_15 = '1.5',
  VERSION_16 = '1.6',
  VERSION_20 = '2.0',
}

export const OCPPVersionURLPath: Record<OCPPVersion, string> = Object.freeze({
  '1.5': 'OCPP15',
  '1.6': 'OCPP16',
  '2.0': 'OCPP20'
});

export enum OCPPGeneralResponse {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
}

export enum RegistrationStatus {
  ACCEPTED = 'Accepted',
  PENDING = 'Pending',
  REJECTED = 'Rejected'
}

export interface OCPPStatusNotificationRequest {
  connectorId: number;
  errorCode: ChargePointErrorCode;
  info?: string;
  status: ChargePointStatus;
  timestamp?: string;
  vendorId?: string;
  vendorErrorCode?: string;
}

export interface OCPPStatusNotificationRequestExtended extends OCPPStatusNotificationRequest {
  chargeBoxID: string;
  timezone: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OCPPStatusNotificationResponse {
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OCPPHeartbeatRequest {
}

export interface OCPPHeartbeatRequestExtended extends OCPPHeartbeatRequest {
  chargeBoxID: string;
  timestamp: Date;
  timezone: string;
}

export interface OCPPHeartbeatResponse {
  currentTime: string;
}

export interface OCPP15MeterValuesRequest {
  connectorId: number;
  transactionId?: number;
  values: OCPP15MeterValue | OCPP15MeterValue[];
}

export interface OCPP15MeterValue {
  timestamp: string;
  value: OCPP15MeterValueValue | OCPP15MeterValueValue[];
}

export interface OCPP15MeterValueValue {
  $attributes: OCPPAttribute;
  $value: string;
}

export interface OCPPMeterValuesRequest {
  connectorId: number;
  transactionId?: number;
  meterValue: OCPPMeterValue | OCPPMeterValue[]; // OCPP 1.6
  values?: OCPPMeterValue | OCPPMeterValue[]; // OCPP 1.5
}

export type OCPPMeterValuesRequestExtended = OCPPMeterValuesRequest;

export interface OCPPRawMeterValues {
  beginAt: Date,
  endAt: Date,
  meterValues: OCPPMeterValuesRequestExtended
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OCPPMeterValuesResponse {}

export interface OCPPNormalizedMeterValues {
  chargeBoxID: string;
  siteID: string;
  siteAreaID: string;
  companyID: string;
  values: OCPPNormalizedMeterValue[];
}

export interface OCPPNormalizedMeterValue {
  id: string;
  chargeBoxID: string;
  siteID: string;
  siteAreaID: string;
  companyID: string;
  connectorId: number;
  transactionId: number;
  timestamp: Date;
  attribute: OCPPAttribute;
  value: string | number;
}

export interface OCPPMeterValue {
  timestamp: string;
  sampledValue: OCPPSampledValue[];
}

export interface OCPPSampledValue extends OCPPAttribute {
  value: string;
}

export interface OCPPAttribute {
  context?: OCPPReadingContext;
  format?: OCPPValueFormat;
  measurand?: OCPPMeasurand;
  phase?: OCPPPhase;
  location?: OCPPLocation;
  unit?: OCPPUnitOfMeasure;
}

export enum OCPPReadingContext {
  INTERRUPTION_BEGIN = 'Interruption.Begin',
  INTERRUPTION_END = 'Interruption.End',
  OTHER = 'Other',
  SAMPLE_CLOCK = 'Sample.Clock',
  SAMPLE_PERIODIC = 'Sample.Periodic',
  TRANSACTION_BEGIN = 'Transaction.Begin',
  TRANSACTION_END = 'Transaction.End',
  TRIGGER = 'Trigger'
}

export enum OCPPValueFormat {
  RAW = 'Raw',
  SIGNED_DATA = 'SignedData',
}

export enum OCPPMeasurand {
  CURRENT_EXPORT = 'Current.Export',
  CURRENT_IMPORT = 'Current.Import',
  CURRENT_OFFERED = 'Current.Offered',
  ENERGY_ACTIVE_EXPORT_REGISTER = 'Energy.Active.Export.Register',
  ENERGY_ACTIVE_IMPORT_REGISTER = 'Energy.Active.Import.Register',
  ENERGY_REACTIVE_EXPORT_REGISTER = 'Energy.Reactive.Export.Register',
  ENERGY_REACTIVE_IMPORT_REGISTER = 'Energy.Reactive.Import.Register',
  ENERGY_ACTIVE_EXPORT_INTERVAL = 'Energy.Active.Export.Interval',
  ENERGY_ACTIVE_IMPORT_INTERVAL = 'Energy.Active.Import.Interval',
  ENERGY_REACTIVE_EXPORT_INTERVAL = 'Energy.Reactive.Export.Interval',
  ENERGY_REACTIVE_IMPORT_INTERVAL = 'Energy.Reactive.Import.Interval',
  FREQUENCY = 'Frequency',
  POWER_ACTIVE_EXPORT = 'Power.Active.Export',
  POWER_ACTIVE_IMPORT = 'Power.Active.Import',
  POWER_FACTOR = 'Power.Factor',
  POWER_OFFERED = 'Power.Offered',
  POWER_REACTIVE_EXPORT = 'Power.Reactive.Export',
  POWER_REACTIVE_IMPORT = 'Power.Reactive.Import',
  FAN_RPM = 'RPM',
  STATE_OF_CHARGE = 'SoC',
  TEMPERATURE = 'Temperature',
  VOLTAGE = 'Voltage'
}

export enum OCPPPhase {
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
  N = 'N',
  L1_N = 'L1-N',
  L2_N = 'L2-N',
  L3_N = 'L3-N',
  L1_L2 = 'L1-L2',
  L2_L3 = 'L2-L3',
  L3_L1 = 'L3-L1'
}

export enum OCPPLocation {
  BODY = 'Body',
  CABLE = 'Cable',
  EV = 'EV',
  INLET = 'Inlet',
  OUTLET = 'Outlet'
}

export enum OCPPUnitOfMeasure {
  WATT_HOUR = 'Wh',
  KILO_WATT_HOUR = 'kWh',
  VAR_HOUR = 'varh',
  KILO_VAR_HOUR = 'kvarh',
  WATT = 'W',
  KILO_WATT = 'kW',
  VOLT_AMP = 'VA',
  KILO_VOLT_AMP = 'kVA',
  VAR = 'var',
  KILO_VAR = 'kvar',
  AMP = 'A',
  VOLT = 'V',
  TEMP_CELSIUS = 'Celsius',
  TEMP_FAHRENHEIT = 'Fahrenheit',
  TEMP_KELVIN = 'K',
  PERCENT = 'Percent'
}

export enum ChargePointErrorCode {
  CONNECTOR_LOCK_FAILURE = 'ConnectorLockFailure',
  EV_COMMUNICATION_ERROR = 'EVCommunicationError',
  GROUND_FAILURE = 'GroundFailure',
  HIGH_TEMPERATURE = 'HighTemperature',
  INTERNAL_ERROR = 'InternalError',
  LOCAL_LIST_CONFLICT = 'LocalListConflict',
  NO_ERROR = 'NoError',
  OTHER_ERROR = 'OtherError',
  OVER_CURRENT_FAILURE = 'OverCurrentFailure',
  OVER_VOLTAGE = 'OverVoltage',
  POWER_METER_FAILURE = 'PowerMeterFailure',
  POWER_SWITCH_FAILURE = 'PowerSwitchFailure',
  READER_FAILURE = 'ReaderFailure',
  RESET_FAILURE = 'ResetFailure',
  UNDER_VOLTAGE = 'UnderVoltage',
  WEAK_SIGNAL = 'WeakSignal'
}

export enum ChargePointStatus {
  AVAILABLE = 'Available',
  PREPARING = 'Preparing',
  CHARGING = 'Charging',
  OCCUPIED = 'Occupied',
  SUSPENDED_EVSE = 'SuspendedEVSE',
  SUSPENDED_EV = 'SuspendedEV',
  FINISHING = 'Finishing',
  RESERVED = 'Reserved',
  UNAVAILABLE = 'Unavailable',
  FAULTED = 'Faulted',
}

export interface OCPPAuthorizeRequest {
  idTag: string;
}

export interface OCPPAuthorizeRequestExtended extends OCPPAuthorizeRequest {
  chargeBoxID: string;
  timestamp: Date;
  timezone: string;
  user: User;
  authorizationId?: string;
}

export interface OCPPAuthorizeResponse {
  idTagInfo: OCPPIdTagInfo;
}

export interface OCPPIdTagInfo {
  status: OCPPAuthorizationStatus;
  expiryDate?: Date;
  parentIdTag?: string;
}

export enum OCPPAuthorizationStatus {
  ACCEPTED = 'Accepted',
  BLOCKED = 'Blocked',
  EXPIRED = 'Expired',
  INVALID = 'Invalid',
  CONCURRENT_TX = 'ConcurrentTx'
}

export interface OCPPDiagnosticsStatusNotificationRequest {
  status: OCPPDiagnosticsStatus;
}

export interface OCPPDiagnosticsStatusNotificationRequestExtended extends OCPPDiagnosticsStatusNotificationRequest {
  chargeBoxID: string;
  timestamp: Date;
  timezone: string;
}

export enum OCPPDiagnosticsStatus {
  IDLE = 'Idle',
  UPLOADED = 'Uploaded',
  UPLOAD_FAILED = 'UploadFailed',
  UPLOADING = 'Uploading'
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OCPPDiagnosticsStatusNotificationResponse {
}

export interface OCPPFirmwareStatusNotificationRequest {
  status: OCPPFirmwareStatus;
}

export enum OCPPFirmwareStatus {
  DOWNLOADED = 'Downloaded',
  DOWNLOAD_FAILED = 'DownloadFailed',
  DOWNLOADING = 'Downloading',
  IDLE = 'Idle',
  INSTALLATION_FAILED = 'InstallationFailed',
  INSTALLING = 'Installing',
  INSTALLED = 'Installed'
}

export interface OCPPFirmwareStatusNotificationRequestExtended extends OCPPFirmwareStatusNotificationRequest {
  chargeBoxID: string;
  timestamp: Date;
  timezone: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface OCPPFirmwareStatusNotificationResponse {
}

export interface OCPPStartTransactionRequest {
  connectorId: number;
  idTag: string;
  meterStart: number;
  reservationId?: number;
  timestamp: string;
}

export interface OCPPStartTransactionRequestExtended extends OCPPStartTransactionRequest {
  chargeBoxID: string;
  tagID: string;
  timezone: string;
  userID: string;
  siteAreaID: string;
  siteID: string;
  companyID: string;
}

export interface OCPPStartTransactionResponse {
  transactionId: number;
  idTagInfo: OCPPIdTagInfo;
}

export interface OCPPDataTransferRequest {
  vendorId: string;
  messageId?: string;
  data?: string;
}

export interface OCPPDataTransferRequestExtended extends OCPPDataTransferRequest {
  chargeBoxID: string;
  timestamp: Date;
  timezone: string;
}

export interface OCPPDataTransferResponse {
  status: OCPPDataTransferStatus;
  data?: string;
}

export enum OCPPDataTransferStatus {
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
  UNKNOWN_MESSAGE_ID = 'UnknownMessageId',
  UNKNOWN_VENDOR_ID = 'UnknownVendorId'
}

export interface OCPPStopTransactionRequest {
  idTag?: string;
  meterStop: number;
  timestamp: string;
  transactionId: number;
  reason?: OCPPReason;
  transactionData?: OCPP15TransactionData | OCPPMeterValue[];
}

export interface OCPP15TransactionData {
  values: OCPP15MeterValue | OCPP15MeterValue[];
}

export enum OCPPReason {
  EMERGENCY_STOP = 'EmergencyStop',
  EV_DISCONNECTED = 'EVDisconnected',
  HARD_RESET = 'HardReset',
  LOCAL = 'Local',
  OTHER = 'Other',
  POWER_LOSS = 'PowerLoss',
  REBOOT = 'Reboot',
  REMOTE = 'Remote',
  SOFT_RESET = 'SoftReset',
  UNLOCK_COMMAND = 'UnlockCommand',
  DE_AUTHORIZED = 'DeAuthorized'
}

export interface OCPPStopTransactionRequestExtended extends OCPPStopTransactionRequest {
  chargeBoxID: string;
}

export interface OCPPStopTransactionResponse {
  idTagInfo: OCPPIdTagInfo;
}
