// Important: One of the following five options MUST be provided

export interface OICPIdentification {
  RFIDMifareFamilyIdentification?: OICPRFIDmifarefamilyIdentification, // Authentication data details. The data structure differs depending on the authentication technology
  RFIDIdentification?: OICPRFIDIdentification, // Authentication data details. The data structure differs depending on the authentication technology
  QRCodeIdentification?: OICPQRCodeIdentification, // Authentication data details. The data structure differs depending on the authentication technology
  PlugAndChargeIdentification?: OICPPlugAndChargeIdentification, // Authentication required for Plug&Charge (EMAID/EVCOID)
  RemoteIdentification?: OICPRemoteIdentificationType, // Authentication data details. The data structure differs depending on the authentication technology
}

export interface OICPRFIDmifarefamilyIdentification {
  UID: OICPUID // The UID from the RFID-Card. It should be read from left to right using big-endian format. Hubject will automatically convert all characters from lower case to upper case. Field Length = 50
}

export interface OICPRFIDIdentification {
  UID: OICPUID // The UID from the RFID-Card. It should be read from left to right using big-endian format. Hubject will automatically convert all characters from lower case to upper case.
  EvcoID?: OICPEvcoID, // Contract identifier. Hubject will automatically convert all characters from lower case to upper case. A string that MUST be valid with respect to the following regular expression: ISO | DIN ^(([A-Za-z]{2}\-?[A-Za-z0-9]{3}\-?C[A-Za-z0-9]{8}\-?[\d|A-Za-z])|([A-Za-z]{2}[\*|\-]?[A-Za-z0-9]{3}[\*|\-]?[A-Za-z0-9]{6}[\*|\-]?[\d|X]))$ Examples ISO: “DE-8EO-CAet5e4XY-3”, “DE8EOCAet5e43X1” Examples DIN: “DE*8EO*Aet5e4*3”, “DE-8EO-Aet5e4-3”, “DE8EOAet5e43”
  RFID: OICPRFID, // The Type of the used RFID card like mifareclassic, desfire.
  PrintedNumber?: string, // A number printed on a customer’s card for manual authorization (e.q. via a call center) Field Length = 150
  ExpiryDate?: Date // Until when this card is valid. Should not be set if card does not have an expiration
}

export interface OICPQRCodeIdentification {
  EvcoID: OICPEvcoID, // Contract identifier. Hubject will automatically convert all characters from lower case to upper case. A string that MUST be valid with respect to the following regular expression: ISO | DIN ^(([A-Za-z]{2}\-?[A-Za-z0-9]{3}\-?C[A-Za-z0-9]{8}\-?[\d|A-Za-z])|([A-Za-z]{2}[\*|\-]?[A-Za-z0-9]{3}[\*|\-]?[A-Za-z0-9]{6}[\*|\-]?[\d|X]))$ Examples ISO: “DE-8EO-CAet5e4XY-3”, “DE8EOCAet5e43X1” Examples DIN: “DE*8EO*Aet5e4*3”, “DE-8EO-Aet5e4-3”, “DE8EOAet5e43”
  PIN?: string, // According to different processes, the PIN is transferred as encrypted hash or in clear text. Field Length = 20
  HashedPIN?: string
}

export interface OICPPlugAndChargeIdentification {
  EvcoID: OICPEvcoID, // Contract identifier. Hubject will automatically convert all characters from lower case to upper case. A string that MUST be valid with respect to the following regular expression: ISO | DIN ^(([A-Za-z]{2}\-?[A-Za-z0-9]{3}\-?C[A-Za-z0-9]{8}\-?[\d|A-Za-z])|([A-Za-z]{2}[\*|\-]?[A-Za-z0-9]{3}[\*|\-]?[A-Za-z0-9]{6}[\*|\-]?[\d|X]))$ Examples ISO: “DE-8EO-CAet5e4XY-3”, “DE8EOCAet5e43X1” Examples DIN: “DE*8EO*Aet5e4*3”, “DE-8EO-Aet5e4-3”, “DE8EOAet5e43”
}

export interface OICPRemoteIdentificationType {
  EvcoID: OICPEvcoID, // Contract identifier. Hubject will automatically convert all characters from lower case to upper case. A string that MUST be valid with respect to the following regular expression: ISO | DIN ^(([A-Za-z]{2}\-?[A-Za-z0-9]{3}\-?C[A-Za-z0-9]{8}\-?[\d|A-Za-z])|([A-Za-z]{2}[\*|\-]?[A-Za-z0-9]{3}[\*|\-]?[A-Za-z0-9]{6}[\*|\-]?[\d|X]))$ Examples ISO: “DE-8EO-CAet5e4XY-3”, “DE8EOCAet5e43X1” Examples DIN: “DE*8EO*Aet5e4*3”, “DE-8EO-Aet5e4-3”, “DE8EOAet5e43”
}

export interface OICPHash {
  Value: OICPHashValue, // Hash value.
  Function: OICPHashFunction, // Function that was used to generate the hash value.
  Salt?: string // In case that a salt value was used to generate the hash value (e.g. salted SHA-1 hash) the salt can be provided in this field. Where the Hash Function is Bcrypt, this value is undefined. Field Length = 100
}

export enum OICPHashFunction {
  Bcrypt = 'Bcrypt' // Hash value is based on Bcrypt.
}
export enum OICPRFID { // Defined RFID Types
  mifareCls = 'mifareCls',
  mifareDes = 'mifareDes',
  calypso = 'calypso',
  nfc = 'nfc',
  mifareFamily = 'mifareFamily'
}

export enum OICPDefaultTagId {
  QRCodeIdentification = 'NoTagID-OICPQRCode',
  PlugAndChargeIdentification = 'NoTagID-OICPPlug&Cha',
  RemoteIdentification = 'NoTagID-OICPRemote'
}

export type OICPEvcoID = string; // Contract identifier. Hubject will automatically convert all characters from lower case to upper case. A string that MUST be valid with respect to the following regular expression: ISO | DIN ^(([A-Za-z]{2}\-?[A-Za-z0-9]{3}\-?C[A-Za-z0-9]{8}\-?[\d|A-Za-z])|([A-Za-z]{2}[\*|\-]?[A-Za-z0-9]{3}[\*|\-]?[A-Za-z0-9]{6}[\*|\-]?[\d|X]))$ Examples ISO: “DE-8EO-CAet5e4XY-3”, “DE8EOCAet5e43X1” Examples DIN: “DE*8EO*Aet5e4*3”, “DE-8EO-Aet5e4-3”, “DE8EOAet5e43”
export type OICPUID = string; // ^([0-9A-F]{8,8}|[0-9A-F]{14,14}|[0-9A-F]{20,20})$ The expression validates the string as a unique RFID with a length of 8, 14 or 20 characters. Examples: “AFFH1768”, “7568290FFF765F”
export type OICPSessionID = string; // A string that MUST be valid with respect to the following regular expression: ^[A-Za-z0-9]{8}(-[A-Za-z0-9]{4}){3}-[A-Za-z0-9]{12}$ The expression validates the string as a GUID. Example: “b2688855-7f00-0002-6d8e-48d883f6abb6”
export type OICPHashValue = string; // ^[0-9A-Za-z]{10,100}$ The expression validates the string as a hash function result value with a length between 10 and 100 characters. Example: “a5ghdhf73h”
