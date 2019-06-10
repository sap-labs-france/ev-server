import Constants from "../../utils/Constants";
import JsonRestChargingStationClient from "./json/JsonRestChargingStationClient";
import SoapChargingStationClient from "./soap/SoapChargingStationClient";
import BackendError from "../../exception/BackendError";
import TSGlobal from '../../types/GlobalType';

declare var global: TSGlobal;

const buildChargingStationClient = async function (chargingStation) {
  let chargingClient = null;
  // Check protocol
  switch (chargingStation.getOcppProtocol()) {
    // JSON
    case Constants.OCPP_PROTOCOL_JSON:
      // Get the client from JSon Server
      if (global.centralSystemJson) {
        chargingClient = global.centralSystemJson.getChargingStationClient(chargingStation.getTenantID(), chargingStation.getID());
      }
      // Not Found
      if (!chargingClient) {
        // Use the remote client
        chargingClient = new JsonRestChargingStationClient(chargingStation);
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
    throw new BackendError(chargingStation.getID(), "Client has not been found",
      "ChargingStationClient", "getChargingStationClient");
  }
  return chargingClient;
};

export default buildChargingStationClient;