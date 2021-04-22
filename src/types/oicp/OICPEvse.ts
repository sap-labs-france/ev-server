import { Voltage } from '../ChargingStation';

export interface OICPEvseMatch {
  EVSE: OICPEvseDataRecord, // Charging point information
  Distance?: number // Decimal (4,1) Air distance to the requested position in km (non-routed)
}

export interface OICPEvseDataRecord {
  deltaType?: OICPDelta, // In case that the operation “PullEvseData” is performed with the parameter “LastCall”, Hubject assigns this attribute to every response EVSE record in order to return the changes compared to the last call.
  lastUpdate?: Date, // The attribute indicates the date and time of the last update of the record. Hubject assigns this attribute to every response EVSE record.
  EvseID: OICPEvseID, // The ID that identifies the charging spot.
  ChargingPoolID?: OICPChargingPoolID, // The ID that identifies the charging station.
  ChargingStationID?: string, // The ID that identifies the charging station. Field Length = 50
  ChargingStationNames: OICPInfoText[], // Name of the charging station in different Languages
  HardwareManufacturer?: string, // Name of the charging point manufacturer. Field Length = 50
  ChargingStationImage?: string, // URL that redirect to an online image of the related EVSEID. Field Length = 200
  SubOperatorName?: string, // Name of the Sub Operator owning the Charging Station. Field Length = 100
  Address: OICPAddressIso19773, // Address of the charging station.
  GeoCoordinates?: OICPGeoCoordinates, // Geolocation of the charging station. Field Length = 100
  Plugs: OICPPlug[], // List of plugs that are supported.
  DynamicPowerLevel?: boolean, // Informs is able to deliver different power outputs.
  ChargingFacilities: OICPChargingFacility[], // List of facilities that are supported.
  RenewableEnergy: boolean, // If the Charging Station provides only renewable energy then the value must be” true”, if it use grey energy then value must be “false”.
  EnergySource?: OICPEnergySource[], // List of energy source that the charging station uses to supply electric energy.
  EnvironmentalImpact?: OICPEnvironmentalImpact, // Environmental Impact produced by the energy sources used by the charging point
  CalibrationLawDataAvailability: OICPCalibrationLawDataAvailability, // This field gives the information how the charging station provides metering law data.
  AuthenticationModes: OICPAuthenticationMode[], // List of authentication modes that are supported.
  MaxCapacity?: number, // Integer. Maximum capacity in kWh
  PaymentOptions: OICPPaymentOption[], // List of payment options that are supported.
  ValueAddedServices: OICPValueAddedService[], // List of value added services that are supported.
  Accessibility: OICPAccessibility, // Specifies how the charging station can be accessed.
  AccessibilityLocation?: OICPAccessibilityLocation[], // Inform the EV driver where the ChargingPoint could be accessed.
  HotlinePhoneNumber: OICPPhoneNumber, // Phone number of a hotline of the charging station operator.
  AdditionalInfo?: OICPInfoText[], // Optional information. Field Length = 200
  ChargingStationLocationReference?: OICPInfoText[], // Last meters information regarding the location of the Charging Station
  GeoChargingPointEntrance?: OICPGeoCoordinates, // In case that the charging spot is part of a bigger facility (e.g. parking place), this attribute specifies the facilities entrance coordinates.
  IsOpen24Hours: boolean, // Set in case the charging spot is open 24 hours.
  OpeningTimes?: OICPOpeningTimes[], // Opening time in case that the charging station cannot be accessed around the clock.
  ClearinghouseID?: string, // Identification of the corresponding clearing house in the event that roaming between different clearing houses must be processed in the future. Field Length = 20
  IsHubjectCompatible: boolean, // Is eRoaming via intercharge at this charging station possible? If set to "false" the charge spot will not be started/stopped remotely via Hubject.
  DynamicInfoAvailable: OICPDynamicInfoAvailable // Values; true / false / auto This attribute indicates whether a CPO provides (dynamic) EVSE Status info in addition to the (static) EVSE Data for this EVSERecord. Value auto is set to true by Hubject if the operator offers Hubject EVSEStatus data.
}

export enum OICPDelta {
  update = 'update',
  insert = 'insert',
  delete = 'delete'
}

export interface OICPInfoText {
  lang: OICPLanguageCode, // The language in which the additional info text is provided.
  value: string // The Additional Info text. Field Length = 150
}

export interface OICPAddressIso19773 {
  Country: OICPCountryCode,
  City: string, // Field Length = 11-50
  Street: string, // Field Length = 2-100
  PostalCode: string, // Field Length = 10
  HouseNum: string, // Field Length = 10
  Floor?: string, // Field Length = 5
  Region?: string, // Field Length = 50
  ParkingFacility?: boolean,
  ParkingSpot?: string, // Field Length = 5
  Timezone?: OICPTimezone,
}

export interface OICPGeoCoordinates { // Important: One of the following three options MUST be provided
  Google?: OICPGeoCoordinatesGoogle, // Geocoordinates using Google Structure
  DecimalDegree?: OICPGeoCoordinatesDecimalDegree, // Geocoordinates using DecimalDegree Structure
  DegreeMinuteSeconds?: OICPGeoCoordinatesDegreeMinuteSeconds // Geocoordinates using DegreeMinutesSeconds Structure
}

export enum OICPGeoCoordinatesResponseFormat {
  Google = 'Google', // Based on WGS84.
  DegreeMinuteSeconds = 'DegreeMinuteSeconds', // Based on WGS84.
  DecimalDegree = 'DecimalDegree' // Based on WGS84.
}

export interface OICPGeoCoordinatesGoogle {
  Coordinates: OICPGeoCoordinatesGoogleFormat, // Based on WGS84
}

export interface OICPGeoCoordinatesDecimalDegree {
  Longitude: OICPGeoCoordinatesDecimalDegreeFormat, // Based on WGS84
  Latitude: OICPGeoCoordinatesDecimalDegreeFormat // Based on WGS84
}

export interface OICPGeoCoordinatesDegreeMinuteSeconds {
  Longitude: OICPGeoCoordinatesDegreeMinuteSecondsFormat, // Based on WGS84
  Latitude: OICPGeoCoordinatesDegreeMinuteSecondsFormat // Based on WGS84
}

export enum OICPPlug {
  SmallPaddleInductive = 'Small Paddle Inductive', // Defined plug type.
  LargePaddleInductive = 'Large Paddle Inductive', // Defined plug type.
  AVCONConnector = 'AVCON Connector', // Defined plug type.
  TeslaConnector = 'Tesla Connector', // Defined plug type.
  NEMA520 = 'NEMA 5-20', // Defined plug type.
  TypeEFrenchStandard = 'Type E French Standard', // CEE 7/5.
  TypeFSchuko = 'Type F Schuko', // CEE 7/4.
  TypeGBritishStandard = 'Type G British Standard', // BS 1363.
  TypeJSwissStandard = 'Type J Swiss Standard', // SEV 1011.
  Type1ConnectorCableAttached = 'Type 1 Connector (Cable Attached)', // Cable attached to IEC 62196-1 type 1, SAE J1772 connector.
  Type2Outlet = 'Type 2 Outlet', // IEC 62196-1 type 2.
  Type2ConnectorCableAttached = 'Type 2 Connector (Cable Attached)', // Cable attached to IEC 62196-1 type 2 connector.
  Type3Outlet = 'Type 3 Outlet', // IEC 62196-1 type 3.
  IEC60309SinglePhase = 'IEC 60309 Single Phase', // IEC 60309.
  IEC60309ThreePhase = 'IEC 60309 Three Phase', // IEC 60309.
  CCSCombo2PlugCableAttached = 'CCS Combo 2 Plug (Cable Attached)', // IEC 62196-3 CDV DC Combined Charging Connector DIN SPEC 70121 refers to ISO / IEC 15118-1 DIS, -2 DIS and 15118-3.
  CCSCombo1PlugCableAttached = 'CCS Combo 1 Plug (Cable Attached)', // IEC 62196-3 CDV DC Combined Charging Connector with IEC 62196-1 type 2 SAE J1772 connector.
  CHAdeMO = 'CHAdeMO' // DC CHAdeMO Connector.
}

type OICPVoltage = Voltage;

export interface OICPChargingFacility {
  PowerType: OICPPower, // Charging Facility power type (e.g. AC or DC)
  Voltage?: OICPVoltage, // Voltage of the Charging Facility. Field Length = 3
  Amperage?: number, // Amperage of the Charging Facility. Field Length = 2
  Power: number, // Charging Facility power in kW. Field Length = 3
  ChargingModes?: OICPChargingMode[] // List of charging modes that are supported.
}

export enum OICPPower { // Defined Charging Facility Power Types
  AC_1_PHASE = 'AC_1_PHASE',
  AC_3_PHASE = 'AC_3_PHASE',
  DC = 'DC'
}

export enum OICPChargingMode {
  Mode_1 = 'Mode_1', // Conductive connection between a standard socket-outlet of an AC supply network and electric vehicle without communication or additional safety features (IEC 61851-1)
  Mode_2 = 'Mode_2', // Conductive connection between a standard socket-outlet of an AC supply network and electric vehicle with communication and additional safety features (IEC 61851-1)
  Mode_3 = 'Mode_3', // Conductive connection of an EV to an AC EV supply equipment permanently connected to an AC supply network with communication and additional safety features (IEC 61851-1)
  Mode_4 = 'Mode_4', // Conductive connection of an EV to an AC or DC supply network utilizing a DC EV supply equipment, with (high-level) communication and additional safety features (IEC 61851-1)
  CHAdeMO = 'CHAdeMO' // CHAdeMo Specification
}

export interface OICPEnergySource {
  Energy?: OICPEnergy[],
  Percentage?: number // Percentage of EnergyType being used by the charging stations. Field Length = 2
}

export enum OICPEnergy {
  Solar = 'Solar', // Energy coming from Solar radiation
  Wind = 'Wind', // Energy produced by wind
  HydroPower = 'HydroPower', // Energy produced by the movement of water
  GeothermalEnergy = 'GeothermalEnergy', // Energy coming from the sub-surface of the earth
  Biomass = 'Biomass', // Energy produced using plant or animal material as fuel
  Coal = 'Coal', // Energy produced using coal as fuel
  NuclearEnergy = 'NuclearEnergy', // Energy being produced by nuclear fission
  Petroleum = 'Petroleum', // Energy produced by using Petroleum as fuel
  NaturalGas = 'NaturalGas' // Energy produced using Natural Gas as fuel
}

export interface OICPEnvironmentalImpact {
  CO2Emission?: number, // Decimal. Total CO2 emited by the energy source being used by this charging station to supply energy to EV. Units are in g/kWh. Field Length = 5
  NuclearWaste?: number // Decimal. Total NuclearWaste emited by the energy source being used by this charging station to supply energy to EV. Units are in g/kWh. Field Length = 5
}

export enum OICPCalibrationLawDataAvailability {
  Local = 'Local', // Calibration law data is shown at the charging station.
  External = 'External', // Calibration law data is provided externaly
  NotAvailable = 'Not Available' // Calibration law data is not provided.
}

export enum OICPAuthenticationMode {
  NfcRfidClassic = 'NFC RFID Classic', // Defined authentication.
  NfcRfidDESFire = 'NFC RFID DESFire', // Defined authentication.
  PnC = 'PnC', // ISO/IEC 15118.
  REMOTE = 'REMOTE', // App, QR-Code, Phone.
  DirectPayment = 'Direct Payment', // Remote use via direct payment. E.g. intercharge direct
  NoAuthenticationRequired = 'No Authentication Required' // Not Authentication Method Required
}

export enum OICPPaymentOption { // Note: No Payment can not be combined with other payment option
  NoPayment = 'No Payment', // Free.
  Direct = 'Direct', // E. g. Cash, Card, SMS, …
  Contract = 'Contract', // I. e. Subscription.
}

export enum OICPValueAddedService {
  Reservation = 'Reservation', // Can an EV driver reserve the charging sport via remote services?
  DynamicPricing = 'DynamicPricing', // Does the EVSE ID support dynamic pricing?
  ParkingSensors = 'ParkingSensors', // Is dynamic status info on the parking area in front of the EVSE-ID available?
  MaximumPowerCharging = 'MaximumPowerCharging', // Does the EVSE-ID offer a dynamic maximum power charging?
  PredictiveChargePointUsage = 'PredictiveChargePointUsage', // Is predictive charge Point usage info available for the EVSE-ID?
  ChargingPlans = 'ChargingPlans', // Does the EVSE-ID offer charging plans, e.g. As described in ISO15118-2?
  RoofProvided = 'RoofProvided', // Indicates if the charging station is under a roof
  None = 'None' // There are no value-added services available.
}

export enum OICPAccessibility {
  FreePubliclyAccessible = 'Free publicly accessible', // EV Driver can reach the charging point without paying a fee, e.g. street, free public place, free parking lot, etc.
  RestrictedAccess = 'Restricted access', // EV Driver needs permission to reach the charging point, e.g. Campus, building complex, etc.
  PayingPubliclyAccessible = 'Paying publicly accessible', // EV Driver needs to pay a fee in order to reach the charging point, e.g. payable parking garage, etc.
  TestStation = 'Test Station' // Station is just for testing purposes. Access may be restricted.
}

export enum OICPAccessibilityLocation {
  OnStreet = 'OnStreet', // The charging station is located on the street
  ParkingLot = 'ParkingLot', // The Charging Point is located inside a Parking Lot
  ParkingGarage = 'ParkingGarage', // The Charging Point is located inside a Parking Garage
  UndergroundParkingGarage = 'UndergroundParkingGarage' // The Charging Point is located inside an Underground Parking Garage
}

export interface OICPOpeningTimes {
  Periods: OICPPeriod[], // The starting and end time for pricing product applicability in the specified period
  On: OICPDayValue // Day values to be used in specifying periods on which the product is available. Workdays = Monday – Friday, Weekend = Saturday – Sunday
}

export interface OICPPeriod {
  begin: string, // The opening time. Pattern: [0-9]{2}:[0-9]{2}
  end: string // The closing time. Pattern: [0-9]{2}:[0-9]{2}
}

export enum OICPDayValue {
  Everyday = 'Everyday',
  Workdays = 'Workdays',
  Weekend = 'Weekend',
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday',
  Saturday = 'Saturday',
  Sunday = 'Sunday'
}

export enum OICPDynamicInfoAvailable {
  true = 'true',
  false = 'false',
  auto = 'auto'
}

export interface OICPSearchCenter {
  GeoCoordinates: OICPGeoCoordinates, // The data structure differs depending on the chosen geo coordinates format
  Radius: number // Decimal (4,1) Radius in km around the position that is defined by the geo coordinates
}

export interface OICPOperatorEvseData {
  OperatorID: OICPOperatorID, // The provider whose data records are listed below.
  OperatorName: string, // Free text for operator. Field Length = 100
  EvseDataRecord: OICPEvseDataRecord[] // 0..n EVSE entries
}

export interface OICPOperatorEvseStatus {
  OperatorID: OICPOperatorID, // The provider whose data records are listed below.
  OperatorName?: string, // Free text for operator. Field Length = 100
  EvseStatusRecord: OICPEvseStatusRecord[] // 0..n EvseStatus list
}

export interface OICPEvseStatusRecord {
  EvseID: OICPEvseID, // The ID that identifies the charging spot.
  EvseStatus: OICPEvseStatus, // The status of the charging spot
  ChargingStationID?: string // Not part of OICP protocol
}

export enum OICPEvseStatus {
  Available = 'Available', // Charging Spot is available for charging.
  Reserved = 'Reserved', // Charging Spot is reserved and not available for charging.
  Occupied = 'Occupied', // Charging Spot is busy.
  OutOfService = 'OutOfService', // Charging Spot is out of service and not available for charging.
  EvseNotFound = 'EvseNotFound', // The requested EvseID and EVSE status does not exist within the Hubject database.
  Unknown = 'Unknown' // No status information available.
}

export interface OICPSignedMeteringValues {
  SignedMeteringValue?: string, // Metering signature value (in the Transparency software format). SignedMeteringValue should be always sent in following order 1.SignedMeteringValue for Metering Status “Start” 2.SignedMeteringValue for Metering Status “Progress1” 3.SignedMeteringValue for Metering Status “Progress2” 4.… 5.SignedMeteringValue for Metering Status “Progress8” 6.SignedMeteringValue for Metering Status “End”. Field Length = 3000
  MeteringStatus?: OICPMeteringStatus // The status type of the metering signature provided (e.g. Start, Progress, End)
}

export enum OICPMeteringStatus {
  Start = 'Start', // Metering signature value of the beginning of charging process.
  Progress = 'Progress', // An intermediate metering signature value of the charging process.
  End = 'End', // Metering Signature Value of the end of the charging process.
}

export interface OICPCalibrationLawVerification {
  CalibrationLawCertificateID?: string, // The Calibration Law Compliance ID from respective authority along with the revision and issueing date (Compliance ID : Revision : Date) For eg PTB - X-X-XXXX : V1 : 01Jan2020. Field Length = 100
  PublicKey?: string, // Unique PublicKey for EVSEID can be provided here. Field Length = 1000
  MeteringSignatureUrl?: string, // In this field CPO can also provide a url for xml file. This xml file can give the compiled Calibration Law Data information which can be simply added to invoices for Customer of EMP. The information can contain for eg Charging Station Details, Charging Session Date/Time, SignedMeteringValues (Transparency Software format), SignedMeterValuesVerificationInstruction etc. Field Length = 200
  MeteringSignatureEncodingFormat?: string, // Encoding format of the metering signature data as well as the version (e.g. EDL40 Mennekes: V1). Field Length = 50
  SignedMeteringValuesVerificationInstruction?: string, // Additional information (e.g. instruction on how to use the transparency software). Field Length = 400
}

export interface EvseIdComponents {
  countryCode: string;
  partyId: string;
  connectorId: string;
}

export type OICPCountryCode = string; // The CountryCodeType allows for Alpha-3 country codes only as of OICP 2.2 and OICP 2.3. For Alpha-3 (three-letter) country codes as defined in ISO 3166-1. Examples: AUT Austria, DEU, Germany, FRA France
export type OICPTimezone = string; // [U][T][C][+,-][0-9][0-9][:][0-9][0-9] The expression validates a string as a Time zone with UTC offset. Examples: UTC+01:00, UTC-05:00
export type OICPEvseID = string; // A string that MUST be valid with respect to the following regular expression: ISO | DIN. ^(([A-Za-z]{2}\*?[A-Za-z0-9]{3}\*?E[A-Za-z0-9\*]{1,30})|(\+?[0-9]{1,3}\*[0-9]{3}\*[0-9\*]{1,32}))$ Examples ISO: “DE*AB7*E840*6487”, “DEAB7E8406487” Example DIN: “+49*810*000*438”
export type OICPOperatorID = string; // A string that MUST be valid with respect to the following regular expression: ISO | DIN ^(([A-Za-z]{2}\*?[A-Za-z0-9]{3})|(\+?[0-9]{1,3}\*[0-9]{3}))$ Examples ISO: “DE*A36”, “DEA36”, Example DIN: “+49*536”
export type OICPGeoCoordinatesGoogleFormat = string; // Based on WGS84 A string that MUST be valid with respect to the following regular expression: ^-?1?\d{1,2}\.\d{1,6}\s*\,?\s*-?1?\d{1,2}\.\d{1,6}$ The expression validates the string as geo coordinates with respect to the Google standard. The string contains latitude and longitude (in this sequence) separated by a space. Example: “47.662249 9.360922”
export type OICPLanguageCode = string; // ^[a-z]{2,3}(?:-[A-Z]{2,3}(?:-[a-zA-Z]{4})?)?(?:-x-[a-zA-Z0-9]{1,8})?$ The expression validates the string as a language code as per ISO-639-1 or ISO-639-2/T. The LanguageCodeType is used in the AdditionalInfo field, which is part of the EvseDataRecordType.
export type OICPPhoneNumber = string; // ^\+[0-9]{5,15}$ The expression validates the string as a telephone number starting with “+” and containing only numbers. Example: “+0305132787”
export type OICPGeoCoordinatesDecimalDegreeFormat = string; // A string that MUST be valid with respect to the following regular expression: ^-?1?\d{1,2}\.\d{1,6}$ The expression validates the string as a geo coordinate (longitude or latitude) with decimal degree syntax. Example: “9.360922”, “-21.568201”
export type OICPGeoCoordinatesDegreeMinuteSecondsFormat = string; // A string that MUST be valid with respect to the following regular expression: ^-?1?\d{1,2}°[ ]?\d{1,2}'[ ]?\d{1,2}\.\d+’'$ The expression validates the string as a geo coordinate (longitude or latitude) consisting of degree, minutes, and seconds. Example: “9°21'39.32''”, “-21°34'23.16''
export type OICPChargingPoolID = string; // VSEs may be grouped by using a charging pool id according to emi³ standard definition. The Evse Pool ID MUST match the following structure (the notation corresponds to the augmented Backus-Naur Form (ABNF) as defined in RFC5234): <Evse Pool ID> = <Country Code> <S> <Spot Operator ID> <S> <ID Type> <Pool ID> This leads to the following regular expression: ([A-Za-z]{2}\*?[A-Za-z0-9]{3}\*?P[A-Za-z0-9\*]{1,30}) An example for a valid Evse Pool ID is “IT*123*P456*AB789”
