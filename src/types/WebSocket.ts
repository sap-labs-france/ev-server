import WSClientConfiguration from './configuration/WSClientConfiguration';
import WebSocket from 'ws';

export enum MessageType {
  CALL_MESSAGE = 2, // Caller to Callee
  CALL_RESULT_MESSAGE = 3, // Callee to Caller
  CALL_ERROR_MESSAGE = 4, // Callee to Caller
}

export enum OcppErrorType {
  // Requested Action is not known by receiver
  NOT_IMPLEMENTED = 'NotImplemented',
  // Requested Action is recognized but not supported by the receiver
  NOT_SUPPORTED = 'NotSupported',
  // An internal error occurred and the receiver was not able to process the requested Action successfully
  INTERNAL_ERROR = 'InternalError',
  // Payload for Action is incomplete
  PROTOCOL_ERROR = 'ProtocolError',
  // During the processing of Action a security issue occurred preventing receiver from completing the Action successfully
  SECURITY_ERROR = 'SecurityError',
  // Payload for Action is syntactically incorrect or not conform the PDU structure for Action
  FORMATION_VIOLATION = 'FormationViolation',
  // Payload is syntactically correct but at least one field contains an invalid value
  PROPERTY_RAINT_VIOLATION = 'PropertyraintViolation',
  // Payload for Action is syntactically correct but at least one of the fields violates occurrence raints
  OCCURENCE_RAINT_VIOLATION = 'OccurenceraintViolation',
  // Payload for Action is syntactically correct but at least one of the fields violates data type raints (e.g. "somestring" = 12)
  TYPERAINT_VIOLATION = 'TyperaintViolation',
  // Any other error not covered by the previous ones
  GENERIC_ERROR = 'GenericError',
}

export interface WSClientOptions extends WSClientConfiguration {
  WSOptions?: WebSocket.ClientOptions;
  logTenantID?: string;
  protocols?: string;
}
