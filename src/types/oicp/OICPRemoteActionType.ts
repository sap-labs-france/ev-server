export enum OICPRemoteActionType {
  RESERVATION_START = 'ReservationStart', // Request the Charge Point to reserve a (specific) EVSE for a duration, starting now. If the charging station offers reservation services, the CPO can provide this information in the field ValueAddedServices.
  RESERVATION_STOP = 'ReservationStop', // Request the end of a charging spot reservation.
  REMOTE_START = 'start', // Request the Charge Point to start a transaction on the given EVSE/Connector.
  REMOTE_STOP = 'stop', // Request the Charge Point to stop an ongoing session.
}
