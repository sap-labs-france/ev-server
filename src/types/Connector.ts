import { InactivityStatus, InactivityStatusLevel } from './Transaction';

export default interface Connector {
  connectorId: number;
  currentConsumption: number;
  currentStateOfCharge?: number;
  totalInactivitySecs?: number;
  totalConsumption?: number;
  status: string;
  errorCode?: string;
  info?: string;
  vendorErrorCode?: string;
  power: number;
  type: string;
  voltage?: number;
  amperage?: number;
  activeTransactionID: number;
  activeTransactionDate: Date;
  activeTagID: string;
  statusLastChangedOn?: Date;
  inactivityStatusLevel?: InactivityStatusLevel; // TODO: Use in the mobile app, to be removed in V1.3
  inactivityStatus?: InactivityStatus;
}
