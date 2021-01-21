import Constants from '../../../utils/Constants';
import LockingHelper from '../../../locking/LockingHelper';
import LockingManager from '../../../locking/LockingManager';
import Logging from '../../../utils/Logging';
import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import OCPIEndpoint from '../../../types/ocpi/OCPIEndpoint';
import OCPIEndpointStorage from '../../../storage/mongodb/OCPIEndpointStorage';
import { OCPIRegistrationStatus } from '../../../types/ocpi/OCPIRegistrationStatus';
import { OCPIRole } from '../../../types/ocpi/OCPIRole';
import SchedulerTask from '../../SchedulerTask';
import { ServerAction } from '../../../types/Server';
import { TaskConfig } from '../../../types/TaskConfig';
import Tenant from '../../../types/Tenant';
import TenantComponents from '../../../types/TenantComponents';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'OCPIGetCdrsTask';

export default class OCPIGetCdrsTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      // Check if OCPI component is active
      if (Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        // Get all available endpoints
        const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(tenant.id, { role: OCPIRole.EMSP }, Constants.DB_PARAMS_MAX_LIMIT);
        for (const ocpiEndpoint of ocpiEndpoints.result) {
          await this.processOCPIEndpoint(tenant, ocpiEndpoint);
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPI_PULL_CDRS, error);
    }
  }

  // eslint-disable-next-line no-unused-vars
  private async processOCPIEndpoint(tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<void> {
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPIPullEmspCdrsLock(tenant.id, ocpiEndpoint);
    if (ocpiLock) {
      try {
        // Check if OCPI endpoint is registered
        if (ocpiEndpoint.status !== OCPIRegistrationStatus.REGISTERED) {
          Logging.logDebug({
            tenantID: tenant.id,
            action: ServerAction.OCPI_PULL_CDRS,
            module: MODULE_NAME, method: 'processOCPIEndpoint',
            message: `The OCPI Endpoint ${ocpiEndpoint.name} is not registered. Skipping the ocpiendpoint.`
          });
          return;
        }
        if (!ocpiEndpoint.backgroundPatchJob) {
          Logging.logDebug({
            tenantID: tenant.id,
            action: ServerAction.OCPI_PULL_CDRS,
            module: MODULE_NAME, method: 'processOCPIEndpoint',
            message: `The OCPI Endpoint ${ocpiEndpoint.name} is inactive.`
          });
          return;
        }
        Logging.logInfo({
          tenantID: tenant.id,
          action: ServerAction.OCPI_PULL_CDRS,
          module: MODULE_NAME, method: 'processOCPIEndpointatch',
          message: `The get cdrs process for endpoint ${ocpiEndpoint.name} is being processed`
        });
        // Build OCPI Client
        const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
        // Send EVSE statuses
        const result = await ocpiClient.pullCdrs();
        Logging.logInfo({
          tenantID: tenant.id,
          action: ServerAction.OCPI_PULL_CDRS,
          module: MODULE_NAME, method: 'processOCPIEndpoint',
          message: `The get cdrs process for endpoint ${ocpiEndpoint.name} is completed`,
          detailedMessages: { result }
        });
      } catch (error) {
        // Log error
        Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPI_PULL_CDRS, error);
      } finally {
        // Release the lock
        await LockingManager.release(ocpiLock);
      }
    }
  }
}

