import { OCPIPullLocationsTaskConfig, TaskConfig } from '../../../types/TaskConfig';
import Tenant, { TenantComponents } from '../../../types/Tenant';

import Constants from '../../../utils/Constants';
import LockingHelper from '../../../locking/LockingHelper';
import LockingManager from '../../../locking/LockingManager';
import Logging from '../../../utils/Logging';
import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import OCPIEndpoint from '../../../types/ocpi/OCPIEndpoint';
import OCPIEndpointStorage from '../../../storage/mongodb/OCPIEndpointStorage';
import { OCPIRegistrationStatus } from '../../../types/ocpi/OCPIRegistrationStatus';
import { OCPIRole } from '../../../types/ocpi/OCPIRole';
import { ServerAction } from '../../../types/Server';
import TenantSchedulerTask from '../../TenantSchedulerTask';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'OCPIPullLocationsTask';

export default class OCPIPullLocationsTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      // Check if OCPI component is active
      if (Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        // Get all available endpoints
        const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(tenant, { role: OCPIRole.EMSP }, Constants.DB_PARAMS_MAX_LIMIT);
        for (const ocpiEndpoint of ocpiEndpoints.result) {
          await this.processOCPIEndpoint(tenant, ocpiEndpoint, config);
        }
      }
    } catch (error) {
      // Log error
      await Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPI_EMSP_GET_LOCATIONS, error);
    }
  }

  private async processOCPIEndpoint(tenant: Tenant, ocpiEndpoint: OCPIEndpoint, config: OCPIPullLocationsTaskConfig): Promise<void> {
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPIPullLocationsLock(tenant.id, ocpiEndpoint);
    if (ocpiLock) {
      try {
        // Check if OCPI endpoint is registered
        if (ocpiEndpoint.status !== OCPIRegistrationStatus.REGISTERED) {
          await Logging.logDebug({
            tenantID: tenant.id,
            action: ServerAction.OCPI_EMSP_GET_LOCATIONS,
            module: MODULE_NAME, method: 'processOCPIEndpoint',
            message: `The OCPI endpoint '${ocpiEndpoint.name}' is not registered. Skipping the OCPI endpoint.`
          });
          return;
        }
        if (!ocpiEndpoint.backgroundPatchJob) {
          await Logging.logDebug({
            tenantID: tenant.id,
            action: ServerAction.OCPI_EMSP_GET_LOCATIONS,
            module: MODULE_NAME, method: 'processOCPIEndpoint',
            message: `The OCPI endpoint '${ocpiEndpoint.name}' is inactive.`
          });
          return;
        }
        await Logging.logInfo({
          tenantID: tenant.id,
          action: ServerAction.OCPI_EMSP_GET_LOCATIONS,
          module: MODULE_NAME, method: 'processOCPIEndpoint',
          message: `Pull of Locations for endpoint '${ocpiEndpoint.name}' is being processed`
        });
        // Build OCPI Client
        const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
        // Pull Locations
        const result = await ocpiClient.pullLocations(config.partial);
        await Logging.logInfo({
          tenantID: tenant.id,
          action: ServerAction.OCPI_EMSP_GET_LOCATIONS,
          module: MODULE_NAME, method: 'processOCPIEndpoint',
          message: `Pull of Locations process for endpoint '${ocpiEndpoint.name}' is completed`,
          detailedMessages: { result }
        });
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPI_EMSP_GET_LOCATIONS, error);
      } finally {
        await LockingManager.release(ocpiLock);
      }
    }
  }
}

