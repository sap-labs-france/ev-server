import ChargingStation from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import CpoOICPClient from './CpoOICPClient';
import Logging from '../../utils/Logging';
import OICPClient from './OICPClient';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import OICPEndpointStorage from '../../storage/mongodb/OICPEndpointStorage';
import { OICPRole } from '../../types/oicp/OICPRole';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OICPClientFactory';

export default class OICPClientFactory {
  static async getOicpClient(tenant: Tenant, oicpEndpoint: OICPEndpoint): Promise<OICPClient> {
    // Check if OICP component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.OICP)) {
      const oicpSettings = await SettingStorage.getOICPSettings(tenant.id);
      // Check
      if (!oicpSettings && oicpSettings.oicp) {
        Logging.logError({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'getOicpClient',
          message: 'OICP Settings are not configured'
        });
      }
      switch (oicpEndpoint.role) {
        case OICPRole.CPO:
          return new CpoOICPClient(tenant, oicpSettings.oicp, oicpEndpoint);
        // Case OICPRole.EMSP:
        //   return new EmspOICPClient(tenant, oicpSettings.oicp, oicpEndpoint);
      }
    }
  }

  static async getCpoOicpClient(tenant: Tenant, oicpEndpoint: OICPEndpoint): Promise<CpoOICPClient> {
    if (oicpEndpoint.role === OICPRole.CPO) {
      const client = await OICPClientFactory.getOicpClient(tenant, oicpEndpoint);
      return client as CpoOICPClient;
    }
    Logging.logError({
      tenantID: tenant.id,
      module: MODULE_NAME, method: 'getCpoOicpClient',
      message: `CPO OICP Client is not compatible with endpoint role '${oicpEndpoint.role}'`
    });
  }

  // Tbd: implement EmspOICPClient
  // static async getEmspOicpClient(tenant: Tenant, oicpEndpoint: OICPEndpoint): Promise<EmspOICPClient> {
  //   if (oicpEndpoint.role === OICPRole.EMSP) {
  //     const client = await OICPClientFactory.getOicpClient(tenant, oicpEndpoint);
  //     return client as EmspOICPClient;
  //   }
  //   Logging.logError({
  //     tenantID: tenant.id,
  //     module: MODULE_NAME, method: 'getEmspOicpClient',
  //     message: `EMSP OICP Client is not compatible with endpoint role '${oicpEndpoint.role}'`
  //   });
  // }

  // Tbd: implement OICPEndpointStorage, OICPRegistrationStatus
  // static async getAvailableOicpClient(tenant: Tenant, oicpRole: string): Promise<OICPClient> {
  //   const oicpEndpoints = await OICPEndpointStorage.getOicpEndpoints(tenant.id, { role: oicpRole }, Constants.DB_PARAMS_MAX_LIMIT);
  //   for (const oicpEndpoint of oicpEndpoints.result) {
  //     if (oicpEndpoint.status === OICPRegistrationStatus.REGISTERED) {
  //       const client = await OICPClientFactory.getOicpClient(tenant, oicpEndpoint);
  //       return client;
  //     }
  //   }
  // }

  // Tbd: implement OICPChargingStationClient, OICPRegistrationStatus, OICPEndpointStorage, getEmspOicpClient
  // static async getChargingStationClient(tenant: Tenant, chargingStation: ChargingStation): Promise<OICPChargingStationClient> {
  //   const oicpEndpoints = await OICPEndpointStorage.getOicpEndpoints(tenant.id, { role: OICPRole.EMSP }, Constants.DB_PARAMS_MAX_LIMIT);
  //   for (const oicpEndpoint of oicpEndpoints.result) {
  //     if (oicpEndpoint.status === OICPRegistrationStatus.REGISTERED) {
  //       const client = await OICPClientFactory.getEmspOicpClient(tenant, oicpEndpoint);
  //       if (client) {
  //         return new OICPChargingStationClient(client, chargingStation);
  //       }
  //     }
  //   }
  // }

}
