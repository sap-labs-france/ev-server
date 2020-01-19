import BackendError from '../../exception/BackendError';
import ChargingStation from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import JsonRestChargingStationClient from './json/JsonRestChargingStationClient';
import SoapChargingStationClient from './soap/SoapChargingStationClient';
import ChargingStationClient from './ChargingStationClient';

export default class ChargingStationClientFactory {
  public static async getChargingStationClient(tenantID: string, chargingStation: ChargingStation): Promise<ChargingStationClient> {
    let chargingClient = null;
    // Check protocol
    switch (chargingStation.ocppProtocol) {
      // JSON
      case Constants.OCPP_PROTOCOL_JSON:
        // Get the client from Json Server
        if (global.centralSystemJson) {
          chargingClient = global.centralSystemJson.getChargingStationClient(tenantID, chargingStation.id);
        }
        // Not Found
        if (!chargingClient) {
          // Use the remote client
          chargingClient = new JsonRestChargingStationClient(tenantID, chargingStation);
        }
        break;
        // SOAP
      case Constants.OCPP_PROTOCOL_SOAP:
      default:
        // Init client
        chargingClient = await SoapChargingStationClient.getChargingStationClient(tenantID, chargingStation);
        break;
    }
    // Check
    if (!chargingClient) {
      throw new BackendError({
        source: chargingStation.id,
        module: 'ChargingStationClientFactory',
        method: 'getChargingStationClient',
        message: 'Client has not been found'
      });
    }
    return chargingClient;
  }
}
