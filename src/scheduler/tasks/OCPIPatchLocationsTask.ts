import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import OCPIClient from '../../client/ocpi/OCPIClient';
import OCPIEndpoint from '../../entity/OCPIEndpoint';
import SchedulerTask from '../SchedulerTask';
import Tenant from '../../entity/Tenant';
export default class OCPIPatchLocationsTask implements SchedulerTask {

  static async processTenant(tenant, config) {
    try {
      // Check if OCPI component is active
      if (!tenant.isComponentActive(Constants.COMPONENTS.OCPI)) {
        Logging.logDebug({
          tenantID: tenant.getID(),
          module: 'OCPIPatchLocationsTask',
          method: 'run', action: 'OCPIPatchLocations',
          message: 'OCPI Inactive for this tenant. The task \'OCPIPatchLocationsTask\' is skipped.'
        });

        // Skip execution
        return;
      }
      Logging.logInfo({
        tenantID: tenant.getID(),
        module: 'OCPIPatchLocationsTask',
        method: 'run', action: 'OCPIPatchLocations',
        message: 'The task \'OCPIPatchLocationsTask\' is being run'
      });

      // Get all available endpoints
      const ocpiEndpoints = await OCPIEndpoint.getOcpiEndpoints(tenant.getID());

      for (const ocpiEndpoint of ocpiEndpoints.result) {
        await OCPIPatchLocationsTask.processOCPIEndpoint(ocpiEndpoint, config);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.getID(), 'OCPIPatchLocations', error);
    }
  }

  // eslint-disable-next-line no-unused-vars
  static async processOCPIEndpoint(ocpiEndpoint, config) {
    // Check if OCPI endpoint is registered
    if (ocpiEndpoint.getStatus() != Constants.OCPI_REGISTERING_STATUS.OCPI_REGISTERED) {
      Logging.logDebug({
        tenantID: ocpiEndpoint.getTenantID(),
        module: 'OCPIPatchLocationsTask',
        method: 'run', action: 'OCPIPatchLocations',
        message: `The OCPI Endpoint ${ocpiEndpoint.getName()} is not registered. Skipping the ocpiendpoint.`
      });

      return;
    } else if (!ocpiEndpoint.isBackgroundPatchJobActive()) {
      Logging.logDebug({
        tenantID: ocpiEndpoint.getTenantID(),
        module: 'OCPIPatchLocationsTask',
        method: 'run', action: 'OCPIPatchLocations',
        message: `The OCPI Endpoint ${ocpiEndpoint.getName()} is inactive.`
      });

      return;
    }

    Logging.logInfo({
      tenantID: ocpiEndpoint.getTenantID(),
      module: 'OCPIPatchLocationsTask',
      method: 'patch', action: 'OCPIPatchLocations',
      message: `The patching Locations process for endpoint ${ocpiEndpoint.getName()} is being processed`
    });

    // Build OCPI Client
    const ocpiClient = new OCPIClient(ocpiEndpoint);

    // Send EVSE statuses
    const sendResult = await ocpiClient.sendEVSEStatuses(false);

    Logging.logInfo({
      tenantID: ocpiEndpoint.getTenantID(),
      module: 'OCPIPatchLocationsTask',
      method: 'patch', action: 'OCPIPatchLocations',
      message: `The patching Locations process for endpoint ${ocpiEndpoint.getName()} is completed (Success: ${sendResult.success}/Failure: ${sendResult.failure})`
    });
  }

  async run(config) {
    const tenants = await Tenant.getTenants();
    for (const tenant of tenants.result) {
      OCPIPatchLocationsTask.processTenant(tenant, config);
    }
  }
}

