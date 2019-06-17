import Logging from '../../../utils/Logging';
import Tenant from '../../../entity/Tenant';
import Constants from '../../../utils/Constants';

export default class UtilsService {
  static handleUnknownAction(action, req, res, next) {
    // Action provided
    if (!action) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        "N/A", new Error(`No Action has been provided`), req, res, next);
    } else {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(
        action, new Error(`The Action '${action}' does not exist`), req, res, next);
    }
  }

  public static async isOrganizationComponentActive(tenantID): Promise<boolean> {
    const tenant = await Tenant.getTenant(tenantID);
    if (!tenant) {
      return false;
    }
    return tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
  }
}
