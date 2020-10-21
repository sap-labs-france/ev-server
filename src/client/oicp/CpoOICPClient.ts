import BackendError from '../../exception/BackendError';
import OICPClient from './OICPClient';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import { OICPRole } from '../../types/oicp/OICPRole';
import { OicpSetting } from '../../types/Setting';
import Tenant from '../../types/Tenant';

const MODULE_NAME = 'CpoOCPIClient';

export default class CpoOICPClient extends OICPClient {
  constructor(tenant: Tenant, settings: OicpSetting, oicpEndpoint: OICPEndpoint) {
    super(tenant, settings, oicpEndpoint, OICPRole.CPO);
    if (oicpEndpoint.role !== OICPRole.CPO) {
      throw new BackendError({
        message: `CpoOicpClient requires Oicp Endpoint with role ${OICPRole.CPO}`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
  }
}
