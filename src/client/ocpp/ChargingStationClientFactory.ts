import BackendError from '../../exception/BackendError';
import ChargingStation from '../../types/ChargingStation';
import ChargingStationClient from './ChargingStationClient';
import JsonRestChargingStationClient from './json/JsonRestChargingStationClient';
import OCPIClientFactory from '../ocpi/OCPIClientFactory';
import { OCPPProtocol } from '../../types/ocpp/OCPPServer';
import SoapChargingStationClient from './soap/SoapChargingStationClient';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'ChargingStationClientFactory';

export default class ChargingStationClientFactory {
  public static async getChargingStationClient(tenant: Tenant, chargingStation: ChargingStation): Promise<ChargingStationClient> {
    let chargingClient = null;
    if (chargingStation.issuer) {
      // Check protocol
      switch (chargingStation.ocppProtocol) {
        // JSON
        case OCPPProtocol.JSON:
          // Get the client from Json Server
          if (global.centralSystemJsonServer) {
            chargingClient = global.centralSystemJsonServer.getChargingStationClient(tenant.id, chargingStation.id);
          }
          // Not Found
          if (!chargingClient) {
            // Use the remote client
            chargingClient = new JsonRestChargingStationClient(tenant.id, chargingStation);
          }
          break;
        // SOAP
        case OCPPProtocol.SOAP:
        default:
          // Init client
          chargingClient = await SoapChargingStationClient.getChargingStationClient(tenant.id, chargingStation);
          break;
      }
    } else {
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        throw new BackendError({
          source: chargingStation.id,
          module: MODULE_NAME,
          method: 'getChargingStationClient',
          message: 'Cannot instantiate roaming charging station client: no roaming components active'
        });
      }
      chargingClient = OCPIClientFactory.getChargingStationClient(tenant, chargingStation);
      // TODO: add Hubject support
    }
    // Check
    if (!chargingClient) {
      throw new BackendError({
        source: chargingStation.id,
        module: MODULE_NAME,
        method: 'getChargingStationClient',
        message: 'No charging station client created or found'
      });
    }
    return chargingClient;
  }
}
