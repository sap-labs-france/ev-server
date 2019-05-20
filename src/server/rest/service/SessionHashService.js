const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const AppError = require('../../../exception/AppError');
const User = require('../../../entity/User');
const Tenant = require('../../../entity/Tenant');
const crypto = require('crypto');
const HttpStatus = require('http-status-codes');

class SessionHashService {
  // Check if Session has been updated and require new login
  static async isSessionHashUpdated(req, res, next) {
    // Get tenant id, user id and hash ID
    const userID = req.user.id;
    const tenantID = req.user.tenantID;
    const userHashID = req.user.userHashID;
    const tenantHashID = req.user.tenantHashID;

    try {
      // Check User's Hash
      if (global.userHashMapIDs[`${tenantID}#${userID}`] &&
          global.userHashMapIDs[`${tenantID}#${userID}`] !== userHashID) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User has been updated and will be logged off`,
          HttpStatus.FORBIDDEN,
          'SessionHashService', 'isSessionHashUpdated',
          req.user
        );
      }
      if (global.tenantHashMapIDs[`${tenantID}`] &&
          global.tenantHashMapIDs[`${tenantID}`] !== tenantHashID) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Tenant has been updated and all users will be logged off`,
          HttpStatus.FORBIDDEN,
          'SessionHashService', 'isSessionHashUpdated',
          req.user
        );
      }
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse('SessionHashService', err, req, res, next);
      return true;
    }
    return false;
  }

  // Build User Hash ID
  static buildUserHashID(user) {
    // Get all field that need to be hashed
    const data = user.getLanguage() + '/' +
      user.getRole() + '/' +
      user.getStatus() + '/' +
      user.getTagIDs().join('-');
    //console.log("userHashID:" + data);
    return crypto.createHash('sha256').update(data).digest("hex");
  }

  // Build Tenant Hash ID
  static buildTenantHashID(tenant) {
    // Get all field that need to be hashed
    const data = tenant.getActiveComponentNames().toString();
    //console.log("tenantHashID:" + data);
    return crypto.createHash('sha256').update(data).digest("hex");
  }

  // Rebuild and store User Hash ID
  static async rebuildUserHashID(tenantID, userID) {
    // Build User hash
    const user = await User.getUser(tenantID, userID);
    if (user) {
      const hashID = SessionHashService.buildUserHashID(user);
      // Store the hash
      global.userHashMapIDs[`${tenantID}#${userID}`] = hashID;
      // Log
      Logging.logInfo({
        tenantID: tenantID,
        source: Constants.CENTRAL_SERVER,
        module: "SessionHashService",
        method: "rebuildUserHashID",
        action: "SessionHashHandling",
        message: `User has been changed or deleted`,
        user: userID
      });
    }
  }

  // Rebuild and store Tenant Hash ID
  static async rebuildTenantHashID(tenantID) {
    // Build Tenant hash
    const tenant = await Tenant.getTenant(tenantID);
    const hashID = SessionHashService.buildTenantHashID(tenant);
    // Store the hash
    global.tenantHashMapIDs[`${tenantID}`] = hashID;
    // Log
    Logging.logInfo({
      tenantID: tenantID,
      source: Constants.CENTRAL_SERVER,
      module: "SessionHashService",
      method: "rebuildTenantHashID",
      action: "SessionHashHandling",
      message: `Tenant has been changed or deleted`
    });
  }
}

module.exports = SessionHashService;