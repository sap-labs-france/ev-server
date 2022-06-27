import { OCPIPullTokensTaskConfig, TaskConfig } from '../../../types/TaskConfig';
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

const MODULE_NAME = 'OCPIPullTokensTask';

export default class OCPIPullTokensTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      // Check if OCPI component is active
      if (Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        // Get all available endpoints
        const ocpiEndpoints = await OCPIEndpointStorage.getOcpiEndpoints(tenant, { role: OCPIRole.CPO }, Constants.DB_PARAMS_MAX_LIMIT);
        for (const ocpiEndpoint of ocpiEndpoints.result) {
          await this.processOCPIEndpoint(tenant, ocpiEndpoint, config);
        }
      }
    } catch (error) {
      // Log error
      await Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPI_CPO_GET_TOKENS, error);
    }
  }

  private async processOCPIEndpoint(tenant: Tenant, ocpiEndpoint: OCPIEndpoint, config: OCPIPullTokensTaskConfig): Promise<void> {
    // Get the lock
    const ocpiLock = await LockingHelper.createOCPIPullTokensLock(tenant.id, ocpiEndpoint, config.partial);
    if (ocpiLock) {
      try {
        // Check if OCPI endpoint is registered
        if (ocpiEndpoint.status !== OCPIRegistrationStatus.REGISTERED) {
          await Logging.logDebug({
            tenantID: tenant.id,
            module: MODULE_NAME, method: 'processOCPIEndpoint',
            action: ServerAction.OCPI_CPO_GET_TOKENS,
            message: `The OCPI endpoint '${ocpiEndpoint.name}' is not registered. Skipping the OCPI endpoint.`
          });
          return;
        }
        if (!ocpiEndpoint.backgroundPatchJob) {
          await Logging.logDebug({
            tenantID: tenant.id,
            module: MODULE_NAME, method: 'processOCPIEndpoint',
            action: ServerAction.OCPI_CPO_GET_TOKENS,
            message: `The OCPI endpoint '${ocpiEndpoint.name}' is inactive.`
          });
          return;
        }
        await Logging.logInfo({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'processOCPIEndpoint',
          action: ServerAction.OCPI_CPO_GET_TOKENS,
          message: `Pull of Tokens for endpoint '${ocpiEndpoint.name}' is being processed${config.partial ? ' (only diff)' : ' (full)'}...`
        });
        // Build OCPI Client
        const ocpiClient = await OCPIClientFactory.getCpoOcpiClient(tenant, ocpiEndpoint);
        // Pull Tokens
        const result = await ocpiClient.pullTokens(config.partial);
        await Logging.logInfo({
          tenantID: tenant.id,
          module: MODULE_NAME, method: 'processOCPIEndpoint',
          action: ServerAction.OCPI_CPO_GET_TOKENS,
          message: `Pull of Tokens for endpoint '${ocpiEndpoint.name}' has been completed${config.partial ? ' (only diff)' : ' (full)'}`,
          detailedMessages: { result }
        });
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPI_CPO_GET_TOKENS, error);
      } finally {
        await LockingManager.release(ocpiLock);
      }
    }
  }
}

