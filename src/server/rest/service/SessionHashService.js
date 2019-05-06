const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const AppError = require('../../../exception/AppError');
const User = require('../../../entity/User');
const Tenant = require('../../../entity/Tenant');
const crypto = require('crypto');

class SessionHashService {

  // Check if Session has been updated and require new login
  static isSessionHashUpdated(req, res, next) {
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

      if (!global.userHashMapIDs[`${tenantID}#${userID}`] || global.userHashMapIDs[`${tenantID}#${userID}`] !== userHashID
          || !global.tenantHashMapIDs[`${tenantID}`] || global.tenantHashMapIDs[`${tenantID}`] !== tenantHashID ) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User or Tenant has been updated changed`,
          401, 'SessionHashService', 'isSessionHashUpdated'
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
    const data = user.getLanguage();
    console.log("userHashID:" + data);
    return data;
    // TODO: only for test - uncomment below
    // return crypto.createHash('sha256').update(data).digest("hex");
  }

  // Build Tenant Hash ID
  static buildTenantHashID(tenant) {
    // Get all field taht need to be hashed
    const data = tenant.getActiveComponents().toString();
    console.log("tenantHashID:" + data);
    return data;
    // TODO: only for test - uncomment below
    // return crypto.createHash('sha256').update(data).digest("hex");
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