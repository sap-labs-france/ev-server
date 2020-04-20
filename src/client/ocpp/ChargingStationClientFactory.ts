import BackendError from '../../exception/BackendError';
import ChargingStation from '../../types/ChargingStation';
import global from '../../types/GlobalType';
import { OCPPProtocol } from '../../types/ocpp/OCPPServer';
import ChargingStationClient from './ChargingStationClient';
import JsonRestChargingStationClient from './json/JsonRestChargingStationClient';
import SoapChargingStationClient from './soap/SoapChargingStationClient';
import OCPIClientFactory from '../ocpi/OCPIClientFactory';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import TenantComponents from '../../types/TenantComponents';

const MODULE_NAME = 'ChargingStationClientFactory';

export default class ChargingStationClientFactory {
  public static async getChargingStationClient(tenantID: string, chargingStation: ChargingStation): Promise<ChargingStationClient> {
    let chargingClient = null;

    if (chargingStation.issuer) {
      // Check protocol
      switch (chargingStation.ocppProtocol) {
        // JSON
        case OCPPProtocol.JSON:
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
        case OCPPProtocol.SOAP:
        default:
          // Init client
          chargingClient = await SoapChargingStationClient.getChargingStationClient(tenantID, chargingStation);
          break;
      }
    } else {
      const tenant: Tenant = await TenantStorage.getTenant(tenantID);
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        throw new BackendError({
          source: chargingStation.id,
          module: MODULE_NAME,
          method: 'getChargingStationClient',
          message: 'OCPI component is not active'
        });
      }
      chargingClient = OCPIClientFactory.getChargingStationClient(tenant, chargingStation);
    }
    // Check
    if (!chargingClient) {
      throw new BackendError({
        source: chargingStation.id,
        module: MODULE_NAME,
        method: 'getChargingStationClient',
        message: 'Client has not been found'
      });
    }
    return chargingClient;
  }
}
