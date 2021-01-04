export interface OICPStatus {
  Code: OICPStatusCode; // To be selected from valid range
  Description?: string; // Description. Field Length = 200
  AdditionalInfo?: string; // More information can be provided here. Field Length = 100
}

export enum OICPStatusCode {
  Code000 = '000', // Success. General codes
  Code001 = '001', // Hubject system error. Internal system codes
  Code002 = '002', // Hubject database error. Internal system codes
  Code009 = '009', // Data transaction error. Internal system codes
  Code017 = '017', // Unauthorized Access. Internal system codes
  Code018 = '018', // Inconsistent EvseID. Internal system codes
  Code019 = '019', // Inconsistent EvcoID. Internal system codes
  Code021 = '021', // System error. General codes
  Code022 = '022', // Data error. General codes
  Code101 = '101', // QR Code Authentication failed – Invalid Credentials. Authentication codes
  Code102 = '102', // RFID Authentication failed – invalid UID. Authentication codes
  Code103 = '103', // RFID Authentication failed – card not readable. Authentication codes
  Code105 = '105', // PLC Authentication failed - invalid EvcoID. Authentication codes
  Code106 = '106', // No positive authentication response. Authentication codes / Internal system codes
  Code110 = '110', // QR Code App Authentication failed – time out error. Authentication codes
  Code120 = '120', // PLC (ISO/ IEC 15118) Authentication failed – invalid underlying EvcoID. Authentication codes
  Code121 = '121', // PLC (ISO/ IEC 15118) Authentication failed – invalid certificate. Authentication codes
  Code122 = '122', // PLC (ISO/ IEC 15118) Authentication failed – time out error. Authentication codes
  Code200 = '200', // EvcoID locked. Authentication codes
  Code210 = '210', // No valid contract. Session codes
  Code300 = '300', // Partner not found. Session codes
  Code310 = '310', // Partner did not respond. Session codes
  Code320 = '320', // Service not available. Session codes
  Code400 = '400', // Session is invalid. Session codes
  Code501 = '501', // Communication to EVSE failed. EVSE codes
  Code510 = '510', // No EV connected to EVSE. EVSE codes
  Code601 = '601', // EVSE already reserved. EVSE codes
  Code602 = '602', // EVSE already in use/ wrong token. EVSE codes
  Code603 = '603', // Unknown EVSE ID. EVSE codes
  Code604 = '604', // EVSE ID is not Hubject compatible. EVSE codes
  Code700 = '700' // EVSE out of service. EVSE code
}

export enum OICPErrorClass {
  ConnectorError = 'Connector Error', // Charging process cannot be started or stopped. EV driver needs to check if the the Plug is properly inserted or taken out from socket.
  CriticalError = 'Critical Error' // Charging process stopped abruptly. Reason: Physical check at the station is required. Station cannot be reset online. Or Error with the software or hardware of the station locally. Or Communication failure with the vehicle. Or The error needs to be investigated Or Ground Failure
}

export enum OICPChargingNotification {
  Start = 'Start', // Indicates if the Notification refers to the start of a charging process.
  Progress = 'Progress', // Indicates if the Notification of the progress of the charging session.
  End = 'End', // Indicates if the Notification refers to an end of a charging process.
  Error = 'Error' // Indicates if the Notification refers to an error.
}
