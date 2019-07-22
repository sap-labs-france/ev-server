import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import global from '../../types/GlobalType';
import JsonRestChargingStationClient from './json/JsonRestChargingStationClient';
import SoapChargingStationClient from './soap/SoapChargingStationClient';
import ChargingStation from '../../types/ChargingStation';

const buildChargingStationClient = async function(tenantID: string, chargingStation: ChargingStation) {
  let chargingClient = null;
  // Check protocol
  switch (chargingStation.ocppProtocol) {
    // JSON
    case Constants.OCPP_PROTOCOL_JSON:
      // Get the client from JSon Server
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
      chargingClient = await SoapChargingStationClient.build(chargingStation);
      break;
  }
  // Check
  if (!chargingClient) {
    throw new BackendError(chargingStation.id, 'Client has not been found',
      'ChargingStationClient', 'getChargingStationClient');
  }
  return chargingClient;
};

export default buildChargingStationClient;
