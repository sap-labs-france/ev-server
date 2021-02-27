import User, { UserImportStatus, UserRole, UserStatus } from '../../types/User';

import Constants from '../../utils/Constants';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import UserStorage from '../../storage/mongodb/UserStorage';
import UserValidator from '../../server/rest/v1/validator/UserValidation';
import global from '../../types/GlobalType';

const MODULE_NAME = 'SynchronizeUsersImportTask';

export default class SynchronizeUsersImportTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    const synchronizeUsersImport = LockingManager.createExclusiveLock(tenant.id, LockEntity.USER, 'synchronize-users-import');
    if (await LockingManager.acquire(synchronizeUsersImport)) {
      try {
        const importedUsers = await UserStorage.getImportedUsers(tenant.id, { statuses: [UserImportStatus.UNKNOWN] }, Constants.DB_PARAMS_MAX_LIMIT);
        if (importedUsers.count > 0) {
          for (const importedUser of importedUsers.result) {
            const foundUser = await UserStorage.getUserByEmail(tenant.id, importedUser.email);
            if (foundUser) {
              importedUser.status = UserImportStatus.ERROR;
              importedUser.error = 'Email already exists';
              await UserStorage.saveImportedUser(tenant.id, importedUser);
            } else {
              const user: Partial<User> = {
                firstName: importedUser.firstName,
                name: importedUser.name.toUpperCase(),
                email: importedUser.email.toLowerCase(),
                locale: null, // Defaults to the browser locale
                issuer: true,
                deleted: false,
                role: UserRole.BASIC,
                status: UserStatus.ACTIVE,
                createdBy: importedUser.importedBy,
                createdOn: new Date(),
                passwordWrongNbrTrials: 0,
                notificationsActive: true,
                notifications: {
                  sendSessionStarted: true,
                  sendOptimalChargeReached: true,
                  sendEndOfCharge: true,
                  sendEndOfSession: true,
                  sendUserAccountStatusChanged: true,
                  sendPreparingSessionNotStarted: true,
                  sendUserAccountInactivity: true,
                  sendSessionNotStarted: true,
                  sendNewRegisteredUser: false,
                  sendUnknownUserBadged: false,
                  sendChargingStationStatusError: false,
                  sendChargingStationRegistered: false,
                  sendOcpiPatchStatusError: false,
                  sendOfflineChargingStations: false,
                  sendBillingSynchronizationFailed: false,
                  sendCarCatalogSynchronizationFailed: false,
                  sendEndUserErrorNotification: false,
                  sendSmtpError: false,
                  sendBillingNewInvoice: false,
                  sendComputeAndApplyChargingProfilesFailed: false
                },
              };
              try {
                UserValidator.getInstance().validateUserCreation(user);
                await global.database.getCollection<any>(tenant.id, 'users')
                  .insertOne(user);
                importedUser.status = UserImportStatus.IMPORTED;
                await UserStorage.saveImportedUser(tenant.id, importedUser);
                Logging.logDebug({
                  tenantID: tenant.id,
                  action: ServerAction.SYNCHRONIZE_USERS,
                  module: MODULE_NAME, method: 'SYNCHRONIZE_USERS',
                  message: `User with email: ${importedUser.email} have been created in Tenant ${tenant.name}`
                });
              } catch (error) {
                importedUser.status = UserImportStatus.ERROR;
                importedUser.error = error.message;
                await UserStorage.saveImportedUser(tenant.id, importedUser);
                // Error
                Logging.logError({
                  tenantID: tenant.id,
                  action: ServerAction.SYNCHRONIZE_USERS,
                  module: MODULE_NAME, method: 'createUser',
                  message: `An error occurred when importing user with email: ${importedUser.email}`,
                  detailedMessages: { error }
                });
              }
            }
          }
        }
      } catch (error) {
        // Log error
        Logging.logActionExceptionMessage(tenant.id, ServerAction.SYNCHRONIZE_USERS, error);
      } finally {
        // Release the lock
        await LockingManager.release(synchronizeUsersImport);
      }
    }
  }
}
