module.exports = {
// Requested Action is not known by receiver
 ERROR_NOTIMPLEMENTED : 'NotImplemented',

// Requested Action is recognized but not supported by the receiver
 ERROR_NOTSUPPORTED : 'NotSupported',

// An internal error occurred and the receiver was not able to process the requested Action successfully
 ERROR_INTERNALERROR : 'InternalError',

// Payload for Action is incomplete
 ERROR_PROTOCOLERROR : 'ProtocolError',

// During the processing of Action a security issue occurred preventing receiver from completing the Action successfully
 ERROR_SECURITYERROR : 'SecurityError',

// Payload for Action is syntactically incorrect or not conform the PDU structure for Action
 ERROR_FORMATIONVIOLATION : 'FormationViolation',

// Payload is syntactically correct but at least one field contains an invalid value
 ERROR_PROPERTYRAINTVIOLATION : 'PropertyraintViolation',

// Payload for Action is syntactically correct but at least one of the fields violates occurence raints
 ERROR_OCCURENCERAINTVIOLATION : 'OccurenceraintViolation',

// Payload for Action is syntactically correct but at least one of the fields violates data type raints (e.g. “somestring”: 12)
 ERROR_TYPERAINTVIOLATION : 'TyperaintViolation',

// Any other error not covered by the previous ones
 ERROR_GENERICERROR : 'GenericError'

}