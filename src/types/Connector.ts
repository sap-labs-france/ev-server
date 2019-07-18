export default interface Connector {
  connectorId: number;
  currentConsumption: number;
  currentStateOfCharge: number;
  totalInactivitySecs: number;
  totalConsumption: number;
  status: string;
  errorCode: string;
  info: string;
  vendorErrorCode: string;
  power: number;
  type: string;
  voltage: number;
  amperage: number;
  activeTransactionID: number;
}
