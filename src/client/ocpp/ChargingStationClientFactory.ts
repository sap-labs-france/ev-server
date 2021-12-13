import ChargingStation from '../../types/ChargingStation';
import global from '../../types/GlobalType';
import { OCPPProtocol } from '../../types/ocpp/OCPPServer';
import Tenant, { TenantComponents } from '../../types/Tenant';
import Utils from '../../utils/Utils';
import OCPIClientFactory from '../ocpi/OCPIClientFactory';
import ChargingStationClient from './ChargingStationClient';
import JsonRestChargingStationClient from './json/JsonRestChargingStationClient';
import SoapChargingStationClient from './soap/SoapChargingStationClient';


const MODULE_NAME = 'ChargingStationClientFactory';

export default class ChargingStationClientFactory {
  public static async getChargingStationClient(tenant: Tenant, chargingStation: ChargingStation): Promise<ChargingStationClient> {
    let chargingClient = null;
    if (chargingStation.issuer) {
      // Check protocol
      switch (chargingStation.ocppProtocol) {
        // JSON
        case OCPPProtocol.JSON:
          // Json Server
          if (global.centralSystemJsonServer) {
            // Get the local WS Connection Client
            chargingClient = await global.centralSystemJsonServer.getChargingStationClient(tenant, chargingStation);
          } else {
            // Get the Remote WS Connection Client (Rest)
            chargingClient = new JsonRestChargingStationClient(tenant.id, chargingStation);
          }
          break;
        // SOAP
        case OCPPProtocol.SOAP:
          // Init SOAP client
          chargingClient = await SoapChargingStationClient.getChargingStationClient(tenant, chargingStation);
          break;
      }
    } else if (Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
      chargingClient = OCPIClientFactory.getChargingStationClient(tenant, chargingStation);
    }
    return chargingClient;
  }
}
