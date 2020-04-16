export default interface ConnectorStats {
  totalChargers: number;
  availableChargers: number;
  totalConnectors: number;
  unavailableConnectors: number;
  chargingConnectors: number;
  suspendedConnectors: number;
  availableConnectors: number;
  faultedConnectors: number;
  preparingConnectors: number;
  finishingConnectors: number;
}
