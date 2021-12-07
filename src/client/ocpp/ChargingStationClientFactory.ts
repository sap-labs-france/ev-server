import Tenant, { TenantComponents } from '../../types/Tenant';

import BackendError from '../../exception/BackendError';
import ChargingStation from '../../types/ChargingStation';
import ChargingStationClient from './ChargingStationClient';
import JsonRestChargingStationClient from './json/JsonRestChargingStationClient';
import LoggingHelper from '../../utils/LoggingHelper';
import OCPIClientFactory from '../ocpi/OCPIClientFactory';
import { OCPPProtocol } from '../../types/ocpp/OCPPServer';
import SoapChargingStationClient from './soap/SoapChargingStationClient';
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
    } else {
      if (!Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        throw new BackendError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          module: MODULE_NAME,
          method: 'getChargingStationClient',
          message: 'Cannot instantiate roaming charging station client: no roaming components active'
        });
      }
      chargingClient = OCPIClientFactory.getChargingStationClient(tenant, chargingStation);
    }
    if (!chargingClient) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME,
        method: 'getChargingStationClient',
        message: 'No charging station client created or found'
      });
    }
    return chargingClient;
  }
}
