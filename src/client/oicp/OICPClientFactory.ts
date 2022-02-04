import Tenant, { TenantComponents } from '../../types/Tenant';

import Constants from '../../utils/Constants';
import CpoOICPClient from './CpoOICPClient';
import Logging from '../../utils/Logging';
import OICPClient from './OICPClient';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import OICPEndpointStorage from '../../storage/mongodb/OICPEndpointStorage';
import { OICPRegistrationStatus } from '../../types/oicp/OICPRegistrationStatus';
import { OICPRole } from '../../types/oicp/OICPRole';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'OICPClientFactory';

export default class OICPClientFactory {
  static async getOicpClient(tenant: Tenant, oicpEndpoint: OICPEndpoint): Promise<OICPClient> {
    // Check if OICP component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.OICP)) {
      const oicpSettings = await SettingStorage.getOICPSettings(tenant);
      if (!oicpSettings && oicpSettings.oicp) {
        await Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.OICP_SETTINGS,
          module: MODULE_NAME, method: 'getOicpClient',
          message: 'OICP Settings are not configured'
        });
      }
      switch (oicpEndpoint.role) {
        case OICPRole.CPO:
          return new CpoOICPClient(tenant, oicpSettings.oicp, oicpEndpoint);
        // case OICPRole.EMSP:
        //   return new EmspOICPClient(tenant, oicpSettings.oicp, oicpEndpoint);
      }
    }
  }

  static async getCpoOicpClient(tenant: Tenant, oicpEndpoint: OICPEndpoint): Promise<CpoOICPClient> {
    if (oicpEndpoint.role === OICPRole.CPO) {
      const client = await OICPClientFactory.getOicpClient(tenant, oicpEndpoint);
      return client as CpoOICPClient;
    }
    await Logging.logError({
      tenantID: tenant.id,
      action: ServerAction.OICP_SETTINGS,
      module: MODULE_NAME, method: 'getCpoOicpClient',
      message: `CPO OICP Client is not compatible with endpoint role '${oicpEndpoint.role}'`
    });
  }

  static async getAvailableOicpClient(tenant: Tenant, oicpRole: string): Promise<OICPClient> {
    const oicpEndpoints = await OICPEndpointStorage.getOicpEndpoints(tenant, { role: oicpRole }, Constants.DB_PARAMS_MAX_LIMIT);
    for (const oicpEndpoint of oicpEndpoints.result) {
      if (oicpEndpoint.status === OICPRegistrationStatus.REGISTERED) {
        const client = await OICPClientFactory.getOicpClient(tenant, oicpEndpoint);
        return client;
      }
    }
  }

}
