const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');

class AbstractService {
  static _handleError(error, req, next, action, module, method){
    // Get tenant
    const tenantID = req.user ? req.user.tenantID : Constants.DEFAULT_TENANT;
    // Log Error
    Logging.logException(error, action, Constants.CENTRAL_SERVER, module, method, tenantID, req.user);
    // Continue
    next(error);
  }
}

module.exports = AbstractService;