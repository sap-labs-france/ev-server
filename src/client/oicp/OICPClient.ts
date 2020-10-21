import AxiosFactory from '../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../exception/BackendError';
import OICPEndpoint from '../../types/oicp/OICPEndpoint';
import { OICPRole } from '../../types/oicp/OICPRole';
import { OicpSetting } from '../../types/Setting';
import Tenant from '../../types/Tenant';

const MODULE_NAME = 'OICPClient';

export default abstract class OICPClient {
  protected axiosInstance: AxiosInstance;
  protected oicpEndpoint: OICPEndpoint;
  protected tenant: Tenant;
  protected role: string;
  protected settings: OicpSetting;

  protected constructor(tenant: Tenant, settings: OicpSetting, ocpiEndpoint: OICPEndpoint, role: string) {
    if (role !== OICPRole.CPO && role !== OICPRole.EMSP) {
      throw new BackendError({
        message: `Invalid OICP role '${role}'`,
        module: MODULE_NAME, method: 'constructor',
      });
    }
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant.id);
    this.tenant = tenant;
    this.settings = settings;
    this.oicpEndpoint = ocpiEndpoint;
    this.role = role.toLowerCase();
  }

}
