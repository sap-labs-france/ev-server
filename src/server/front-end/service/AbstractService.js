const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');

class AbstractService {
  static _handleError(error, req, next, action, module, method){
    const tenantID = req.user ? req.user.tenantID : '';
    Logging.logException(error, action, Constants.CENTRAL_SERVER, module, method, tenantID, req.user);
    next(error);
  }
}

module.exports = AbstractService;