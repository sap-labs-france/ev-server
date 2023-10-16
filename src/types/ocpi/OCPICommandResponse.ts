export interface OCPICommandResponse {
  result: OCPICommandResponseType;
}

export enum OCPICommandResponseType {
  NOT_SUPPORTED = 'NOT_SUPPORTED', // The requested command is not supported by this CPO, Charge Point, EVSE etc.
  REJECTED = 'REJECTED', // Command request rejected by the CPO or Charge Point.
  ACCEPTED = 'ACCEPTED', // Command request accepted by the CPO or Charge Point.
  TIMEOUT = 'TIMEOUT', // Command request timeout, no response received from the Charge Point in an reasonable time.
  UNKNOWN_SESSION = 'UNKNOWN_SESSION', // The Session in the requested command is not known by this CPO.
}
