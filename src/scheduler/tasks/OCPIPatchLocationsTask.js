const Logging = require('../../utils/Logging');
const SchedulerTask = require('../SchedulerTask');
const Tenant = require('../../entity/Tenant');
const OCPIEndpoint = require('../../entity/OCPIEndpoint');
const Constants = require('../../utils/Constants');
const OCPIClient = require('../../client/ocpi/OCPIClient');

class OCPIPatchLocationsTask extends SchedulerTask {
  constructor() {
    super();
  }

  async run(config) {
    const tenants = await Tenant.getTenants();
    for (const tenant of tenants.result) {
      OCPIPatchLocationsTask.processTenant(tenant, config);
    }
  }

  static async processTenant(tenant, config) {
    try {
      // check if OCPI component is active
      if (!tenant.isComponentActive(Constants.COMPONENTS.OCPI_COMPONENT)) {
        Logging.logDebug({
          tenantID: tenant.getID(),
          module: "OCPIPatchLocationsTask",
          method: "run", action: "OCPIPatchLocations",
          message: `OCPI Inactive for this tenant. The task 'OCPIPatchLocationsTask' is skipped.`
        });

        // skip execution
        return;
      }
      Logging.logInfo({
        tenantID: tenant.getID(),
        module: "OCPIPatchLocationsTask",
        method: "run", action: "OCPIPatchLocations",
        message: `The task 'OCPIPatchLocationsTask' is being run`
      });

      // get all available endpoints
      const ocpiEndpoints = await OCPIEndpoint.getOcpiendpoints(tenant.getID());

      for (const ocpiEndpoint of ocpiEndpoints.result) {
        await OCPIPatchLocationsTask.processOCPIEndpoint(ocpiEndpoint, config);
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.getID(), "OCPIPatchLocations", error);
    }
  }

  static async processOCPIEndpoint(ocpiEndpoint, config) {
    // check if OCPI endpoint is registered
    if (ocpiEndpoint.getStatus() != Constants.OCPI_REGISTERING_STATUS.OCPI_REGISTERED) {
      Logging.logDebug({
        tenantID: ocpiEndpoint.getTenantID(),
        module: "OCPIPatchLocationsTask",
        method: "run", action: "OCPIPatchLocations",
        message: `The OCPI Endpoint ${ocpiEndpoint.getName()} is not registered. Skipping the ocpiendpoint.`
      });

      return;
    } else if (!ocpiEndpoint.isBackgroundPatchJobActive()) {
      Logging.logDebug({
        tenantID: ocpiEndpoint.getTenantID(),
        module: "OCPIPatchLocationsTask",
        method: "run", action: "OCPIPatchLocations",
        message: `The OCPI Endpoint ${ocpiEndpoint.getName()} is inactive.`
      });

      return;
    }

    Logging.logInfo({
      tenantID: ocpiEndpoint.getTenantID(),
      module: "OCPIPatchLocationsTask",
      method: "path", action: "OCPIPatchLocations",
      message: `The patching Locations process for endpoint ${ocpiEndpoint.getName()} is being processed`
    });

    // build OCPI Client
    const ocpiClient = new OCPIClient(ocpiEndpoint);

    // send EVSE statuses
    const sendResult = await ocpiClient.sendEVSEStatuses();

    Logging.logInfo({
      tenantID: ocpiEndpoint.getTenantID(),
      module: "OCPIPatchLocationsTask",
      method: "path", action: "OCPIPatchLocations",
      message: `The patching Locations process for endpoint ${ocpiEndpoint.getName()} is completed (Success: ${sendResult.success}/Failure: ${sendResult.failure})`
    });





  }
}

module.exports = OCPIPatchLocationsTask;
