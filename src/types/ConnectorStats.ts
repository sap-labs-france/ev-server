export default interface ConnectorStats {
  totalConnectors: number;
  unavailableConnectors: number;
  chargingConnectors: number;
  suspendedConnectors: number;
  availableConnectors: number;
  faultedConnectors: number;
  preparingConnectors: number;
  finishingConnectors: number;
}
