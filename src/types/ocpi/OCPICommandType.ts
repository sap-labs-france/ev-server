export enum OCPICommandType {
  RESERVE_NOW = 'RESERVE_NOW', // Request the Charge Point to reserve a (specific) EVSE for a Token for a certain time, starting now.
  START_SESSION = 'START_SESSION', // Request the Charge Point to start a transaction on the given EVSE/Connector.
  STOP_SESSION = 'STOP_SESSION', // Request the Charge Point to stop an ongoing session.
  UNLOCK_CONNECTOR = 'UNLOCK_CONNECTOR', // Request the Charge Point to unlock the connector (if applicable). This functionality is for help desk operators only!
}
