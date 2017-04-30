class ChargingStationClient {
  constructor() {
    if (new.target === ChargingStationClient) {
      throw new TypeError("Cannot construct ChargingStationClient instances directly");
    }
  }

  reset(type) {
  }

  clearCache() {
  }

  getConfiguration(keys) {
  }

  stopTransaction(transactionId) {
  }

  unlockConnector(connectorId) {
  }
}

module.exports = ChargingStationClient;
