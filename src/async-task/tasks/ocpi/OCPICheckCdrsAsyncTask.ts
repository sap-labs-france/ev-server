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

export default class OCPICheckCdrsAsyncTask extends AbstractAsyncTask {
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
        const checkCdrsLock = await LockingHelper.createOCPICheckCdrsLock(tenant.id, ocpiEndpoint);
        if (checkCdrsLock) {
          try {
            // Get the OCPI Client
            const ocpiClient = await OCPIClientFactory.getCpoOcpiClient(tenant, ocpiEndpoint);
            if (!ocpiClient) {
              throw new Error(`OCPI Client not found in Endpoint ID '${this.getAsyncTask().parameters.endpointID}'`);
            }
            await ocpiClient.checkCdrs();
          } finally {
            // Release the lock
            await LockingManager.release(checkCdrsLock);
          }
        }
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPI_CPO_CHECK_CDRS, error);
      }
    }
  }
}
