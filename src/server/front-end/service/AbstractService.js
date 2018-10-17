const Constants = require( '../../../utils/Constants');
const Logging = require('../../../utils/Logging');

class AbstractService {
    static _handleError(error, req, next, action, module, method){
        Logging.logException(error, action, Constants.CENTRAL_SERVER, module, method, req.user);
        next(error);
    }
}

module.exports = AbstractService;