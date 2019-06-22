import Logging from '../../../utils/Logging';
import Tenant from '../../../entity/Tenant';
import Constants from '../../../utils/Constants';
import AppError from '../../../exception/AppError';
import ComponentInactiveError from '../../../exception/ComponentInactiveError';

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

  public static assertObjectExists(object: any, errorMsg: string, module: string, method: string, userToken) {
    if (!object) {
      // Object does not exist
      throw new AppError(
        Constants.CENTRAL_SERVER,
        errorMsg, 550,
        module, method, userToken);
    }
  }

  public static async assertComponentIsActive(tenantID: string, component: string, action: string, entity: string, module: string, method: string) {
    // Get the tenant
    let active = false;
    const tenant = await Tenant.getTenant(tenantID);
    // Check
    if (tenant) {
      active = tenant.isComponentActive(component);
    }
    // Throw
    if (!active) {
      throw new ComponentInactiveError(
        component, action, entity,
        560, module, method);
    }
  }
}
