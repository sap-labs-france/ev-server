import Constants from '../../utils/Constants';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import Logging from '../../utils/Logging';
import OCPIClient from './OCPIClient';
import EmspOCPIClient from './EmspOCPIClient';
import OCPIEndpoint from '../../types/OCPIEndpoint';
import CpoOCPIClient from './CpoOCPIClient';

export default class OCPIClientFactory {
  static async getOcpiClient(tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIClient> {
    // Check if OCPI component is active
    if (Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.OCPI)
    ) {
      const setting = await SettingStorage.getSettingByIdentifier(tenant.id, Constants.COMPONENTS.OCPI);
      // Check
      if (!setting || !setting.content[Constants.SETTING_REFUND_CONTENT_TYPE_CONCUR]) {
        Logging.logDebug({
          tenantID: tenant.id,
          module: 'OCPIClientFactory',
          method: 'getOcpiClient',
          message: 'OCPI settings are not configured'
        });
      }
      switch (ocpiEndpoint.role) {
        case Constants.OCPI_ROLE.CPO:
          return new EmspOCPIClient(tenant, ocpiEndpoint);
        case Constants.OCPI_ROLE.EMSP:
          return new CpoOCPIClient(tenant, ocpiEndpoint);
      }
    }
    // OCPI is not active
    return null;
  }
}
