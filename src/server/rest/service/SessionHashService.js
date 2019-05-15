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
    // get tenant id, user id and hash ID
    const userID = req.user.id;
    const tenantID = req.user.tenantID;
    const userHashID = req.user.userHashID;
    const tenantHashID = req.user.tenantHashID;

    try {
      if (!global.userHashMapIDs) {
        global.userHashMapIDs = {};
      }

      if (!global.tenantHashMapIDs) {
        global.tenantHashMapIDs = {};
      }

      // check if ID do not exist - means server has been restarted - instead of re-login necessary
      // rebuild the ID for user and tenant
      if (!global.userHashMapIDs[`${tenantID}#${userID}`]) {
        await SessionHashService.rebuildUserHashID(tenantID, userID);
      }
      if (!global.tenantHashMapIDs[`${tenantID}`]) {
        await SessionHashService.rebuildTenantHashID(tenantID);
      }

      // check if Hash on User or Tenant has been updated
      if (global.userHashMapIDs[`${tenantID}#${userID}`] !== userHashID 
          || global.tenantHashMapIDs[`${tenantID}`] !== tenantHashID ) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User or Tenant has been updated`,
          HttpStatus.FORBIDDEN, 'SessionHashService', 'isSessionHashUpdated'
        );
      }
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse('N/A', err, req, res, next);
      return true;
    }

    return false;
  }

  // Build User Hash ID
  static buildUserHashID(user) {
    // Get all field that need to be hashed
    const data = user.getLanguage() + '/' + user.getRole() + '/' + user.getStatus();
    //console.log("userHashID:" + data);
    return crypto.createHash('sha256').update(data).digest("hex");
  }

  // Build Tenant Hash ID
  static buildTenantHashID(tenant) {
    // Get all field taht need to be hashed
    const data = tenant.getActiveComponents().toString();
    //console.log("tenantHashID:" + data);
    return crypto.createHash('sha256').update(data).digest("hex");
  }


  // Rebuild and store User Hash ID
  static async rebuildUserHashID(tenantID, userID) {
    const user = await User.getUser(tenantID, userID);

    const hashID = SessionHashService.buildUserHashID(user);
    SessionHashService.storeUserHashID(tenantID, userID, hashID);
  }

  // Rebuild and store Tenant Hash ID
  static async rebuildTenantHashID(tenantID) {
    const tenant = await Tenant.getTenant(tenantID);

    const hashID = SessionHashService.buildTenantHashID(tenant);
    SessionHashService.storeTenantHashID(tenantID, hashID);
  }

  // Store User Hash ID in global variable
  static storeUserHashID(tenantID, userID, hashID) {
    // Empty if not exist
    global.userHashMapIDs = global.userHashMapIDs ? global.userHashMapIDs : {};

    // Store it
    global.userHashMapIDs[`${tenantID}#${userID}`] = hashID;
  }

  // Store Tenant Hash ID in global variable
  static storeTenantHashID(tenantID, hashID) {
    // Empty if not exist
    global.tenantHashMapIDs = global.tenantHashMapIDs ? global.tenantHashMapIDs : {};

    // Store it
    global.tenantHashMapIDs[`${tenantID}`] = hashID;
  }
}

module.exports = SessionHashService;