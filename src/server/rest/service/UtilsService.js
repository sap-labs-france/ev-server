const Logging = require('../../../utils/Logging');
const Tenant = require('../../../entity/Tenant');
const Constants = require('../../../utils/Constants');

class UtilsService {
  static handleUnknownAction(action, req, res, next) {
    // Action provided
    if (!action) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        "N/A", new Error(`No Action has been provided`), req, res, next);
    } else {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        "N/A", new Error(`The Action '${action}' does not exist`), req, res, next);
    }
  }

  static async isOrganizationComponentActive(tenantID) {
    const tenant = await Tenant.getTenant(tenantID);
    return tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
  }
}

module.exports = UtilsService;
