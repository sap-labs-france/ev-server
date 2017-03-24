
class ChargingStationClient {
  constructor() {
    if (new.target === ChargingStationClient) {
      throw new TypeError("Cannot construct ChargingStationClient instances directly");
    }
  }

  // Restart the server
  reset(args) {
  }

  getConfiguration(args) {
  }
}

module.exports = ChargingStationClient;
