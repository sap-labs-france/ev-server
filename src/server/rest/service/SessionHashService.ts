import crypto from 'crypto';
import HttpStatus from 'http-status-codes';
import AppError from '../../../exception/AppError';
import Constants from '../../../utils/Constants';
import global from '../../../types/GlobalType';
import Logging from '../../../utils/Logging';
import Tenant from '../../../entity/Tenant';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';

export default class SessionHashService {
  // Check if Session has been updated and require new login
  static isSessionHashUpdated(req, res, next) {
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
          'User has been updated and will be logged off',
          HttpStatus.FORBIDDEN,
          'SessionHashService', 'isSessionHashUpdated',
          req.user
        );
      }
      if (global.tenantHashMapIDs[`${tenantID}`] &&
          global.tenantHashMapIDs[`${tenantID}`] !== tenantHashID) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'Tenant has been updated and all users will be logged off',
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
  static buildUserHashID(user: User) {
    // Get all field that need to be hashed
    const data =
      user.locale.substring(0, 2) + '/' +
      user.role + '/' +
      user.status;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Build Tenant Hash ID
  static buildTenantHashID(tenant) {
    // Get all field that need to be hashed
    const data = JSON.stringify(tenant.getActiveComponents());
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Rebuild and store User Hash ID
  static async rebuildUserHashID(tenantID, userID) {
    // Build User hash
    const user = await UserStorage.getUser(tenantID, userID);
    if (user) {
      const hashID = SessionHashService.buildUserHashID(user);
      // Store the hash
      global.userHashMapIDs[`${tenantID}#${userID}`] = hashID;
    }
  }

  // Rebuild and store Tenant Hash ID
  static async rebuildTenantHashID(tenantID) {
    // Build Tenant hash
    const tenant = await Tenant.getTenant(tenantID);
    if (tenant) {
      const hashID = SessionHashService.buildTenantHashID(tenant);
      // Store the hash
      global.tenantHashMapIDs[`${tenantID}`] = hashID;
    }
  }
}
