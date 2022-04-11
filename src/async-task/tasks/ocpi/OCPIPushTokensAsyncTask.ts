import AbstractAsyncTask from '../../AsyncTask';
import LockingHelper from '../../../locking/LockingHelper';
import LockingManager from '../../../locking/LockingManager';
import Logging from '../../../utils/Logging';
import OCPIClientFactory from '../../../client/ocpi/OCPIClientFactory';
import OCPIEndpointStorage from '../../../storage/mongodb/OCPIEndpointStorage';
import { ServerAction } from '../../../types/Server';
import { TenantComponents } from '../../../types/Tenant';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import Utils from '../../../utils/Utils';

export default class OCPIPushTokensAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const tenant = await TenantStorage.getTenant(this.getAsyncTask().tenantID);
    // Check if OCPI component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
      try {
        // Get the OCPI Endpoint
        const ocpiEndpoint = await OCPIEndpointStorage.getOcpiEndpoint(tenant, this.getAsyncTask().parameters.endpointID);
        if (!ocpiEndpoint) {
          throw new Error(`Unknown OCPI Endpoint ID '${this.getAsyncTask().parameters.endpointID}'`);
        }
        const pushTokensLock = await LockingHelper.createOCPIPushTokensLock(tenant.id, ocpiEndpoint);
        if (pushTokensLock) {
          try {
            // Get the OCPI Client
            const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
            if (!ocpiClient) {
              throw new Error(`OCPI Client not found in Endpoint ID '${this.getAsyncTask().parameters.endpointID}'`);
            }
            // Send Tokens
            await ocpiClient.pushTokens();
          } finally {
            // Release the lock
            await LockingManager.release(pushTokensLock);
          }
        }
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPI_EMSP_UPDATE_TOKENS, error);
      }
    }
  }
}
