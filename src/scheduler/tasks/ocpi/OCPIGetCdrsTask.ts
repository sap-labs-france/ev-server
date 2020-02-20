import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import OCPIEndpointStorage from '../../../storage/mongodb/OCPIEndpointStorage';
import OCPIEndpoint from '../../../types/ocpi/OCPIEndpoint';
import { TaskConfig } from '../../../types/TaskConfig';
import Tenant from '../../../types/Tenant';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import SchedulerTask from '../../SchedulerTask';
import { OCPIRole } from '../../../types/ocpi/OCPIRole';
import { OCPIRegistationStatus } from '../../../types/ocpi/OCPIRegistationStatus';

export default class OCPIGetCdrsTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      // Check if OCPI component is active
      if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.OCPI)) {
        Logging.logDebug({
          tenantID: tenant.id,
          module: 'OCPIGetCdrsTask',
          method: 'run', action: 'OcpiGetCdrs',
          message: 'OCPI Inactive for this tenant. The task \'OCPIGetCdrsTask\' is skipped.'
        });
        // Skip execution
        return;
      }
      // Get all available endpoints
      const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(tenant.id, { role: OCPIRole.EMSP }, Constants.DB_PARAMS_MAX_LIMIT);
      for (const ocpiEndpoint of ocpiEndpoints.result) {
        await this.processOCPIEndpoint(tenant, ocpiEndpoint);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'OcpiGetCdrs', error);
    }
  }

  // eslint-disable-next-line no-unused-vars
  async processOCPIEndpoint(tenant: Tenant, ocpiEndpoint: OCPIEndpoint) {
    // Check if OCPI endpoint is registered
    if (ocpiEndpoint.status !== OCPIRegistationStatus.OCPI_REGISTERED) {
      Logging.logDebug({
        tenantID: tenant.id,
        module: 'OCPIGetCdrsTask',
        method: 'run', action: 'OcpiGetSessions',
        message: `The OCPI Endpoint ${ocpiEndpoint.name} is not registered. Skipping the ocpiendpoint.`
      });
      return;
    } else if (!ocpiEndpoint.backgroundPatchJob) {
      Logging.logDebug({
        tenantID: tenant.id,
        module: 'OCPIGetCdrsTask',
        method: 'run', action: 'OcpiGetCdrs',
        message: `The OCPI Endpoint ${ocpiEndpoint.name} is inactive.`
      });
      return;
    }
    Logging.logInfo({
      tenantID: tenant.id,
      module: 'OCPIGetCdrsTask',
      method: 'patch', action: 'OcpiGetCdrs',
      message: `The get cdrs process for endpoint ${ocpiEndpoint.name} is being processed`
    });
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
    // Send EVSE statuses
    const result = await ocpiClient.pullCdrs();
    Logging.logInfo({
      tenantID: tenant.id,
      module: 'OCPIGetCdrsTask',
      method: 'patch', action: 'OcpiGetCdrs',
      message: `The get cdrs process for endpoint ${ocpiEndpoint.name} is completed)`,
      detailedMessages: result
    });
  }
}

