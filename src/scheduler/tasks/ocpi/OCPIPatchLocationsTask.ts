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

export default class OCPIPatchLocationsTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      // Check if OCPI component is active
      if (!Utils.isTenantComponentActive(tenant, Constants.COMPONENTS.OCPI)) {
        Logging.logDebug({
          tenantID: tenant.id,
          module: 'OCPIPatchLocationsTask',
          method: 'run', action: 'OcpiPatchLocations',
          message: 'OCPI Inactive for this tenant. The task \'OCPIPatchLocationsTask\' is skipped.'
        });
        // Skip execution
        return;
      }
      // Get all available endpoints
      const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(tenant.id, { role: OCPIRole.CPO }, Constants.DB_PARAMS_MAX_LIMIT);
      for (const ocpiEndpoint of ocpiEndpoints.result) {
        await this.processOCPIEndpoint(tenant, ocpiEndpoint);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'OcpiPatchLocations', error);
    }
  }

  // eslint-disable-next-line no-unused-vars
  async processOCPIEndpoint(tenant: Tenant, ocpiEndpoint: OCPIEndpoint) {
    // Check if OCPI endpoint is registered
    if (ocpiEndpoint.status !== OCPIRegistationStatus.OCPI_REGISTERED) {
      Logging.logDebug({
        tenantID: tenant.id,
        module: 'OCPIPatchLocationsTask',
        method: 'run', action: 'OcpiPatchLocations',
        message: `The OCPI Endpoint ${ocpiEndpoint.name} is not registered. Skipping the ocpiendpoint.`
      });
      return;
    } else if (!ocpiEndpoint.backgroundPatchJob) {
      Logging.logDebug({
        tenantID: tenant.id,
        module: 'OCPIPatchLocationsTask',
        method: 'run', action: 'OcpiPatchLocations',
        message: `The OCPI Endpoint ${ocpiEndpoint.name} is inactive.`
      });
      return;
    }
    Logging.logInfo({
      tenantID: tenant.id,
      module: 'OCPIPatchLocationsTask',
      method: 'patch', action: 'OcpiPatchLocations',
      message: `The patching Locations process for endpoint ${ocpiEndpoint.name} is being processed`
    });
    // Build OCPI Client
    const ocpiClient = await OCPIClientFactory.getCpoOcpiClient(tenant, ocpiEndpoint);
    // Send EVSE statuses
    const sendResult = await ocpiClient.sendEVSEStatuses(false);
    Logging.logInfo({
      tenantID: tenant.id,
      module: 'OCPIPatchLocationsTask',
      method: 'patch', action: 'OcpiPatchLocations',
      message: `The patching Locations process for endpoint ${ocpiEndpoint.name} is completed (Success: ${sendResult.success}/Failure: ${sendResult.failure})`
    });
  }
}

