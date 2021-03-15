import User, { UserRole, UserStatus } from '../../types/User';

import Constants from '../../utils/Constants';
import DbParams from '../../types/database/DbParams';
import { HTTPError } from '../../types/HTTPError';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import UserStorage from '../../storage/mongodb/UserStorage';

const MODULE_NAME = 'SynchronizeUsersImportTask';

export default class SynchronizeUsersImportTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    const synchronizeUsersImport = LockingManager.createExclusiveLock(tenant.id, LockEntity.USER, 'synchronize-users-import');
    if (await LockingManager.acquire(synchronizeUsersImport)) {
      try {
        const dbParams: DbParams = { limit: Constants.EXPORT_PAGE_SIZE, skip: 0, onlyRecordCount: true };
        let importedUsers = await UserStorage.getImportedUsers(tenant.id, { withNoError: true }, dbParams);
        let count = importedUsers.count;
        delete dbParams.onlyRecordCount;
        let skip = 0;
        // Limit the number of records
        if (count > Constants.EXPORT_RECORD_MAX_COUNT) {
          count = Constants.EXPORT_RECORD_MAX_COUNT;
        }
        do {
          importedUsers = await UserStorage.getImportedUsers(tenant.id, { withNoError: true }, dbParams);
          for (const importedUser of importedUsers.result) {
            const foundUser = await UserStorage.getUserByEmail(tenant.id, importedUser.email);
            if (foundUser) {
              importedUser.errorCode = HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR;
              importedUser.errorDescription = 'Email already exists';
              await UserStorage.saveImportedUser(tenant.id, importedUser);
            } else {
              const user: Partial<User> = {
                firstName: importedUser.firstName,
                name: importedUser.name,
                email: importedUser.email,
                locale: null, // Defaults to the browser locale
                issuer: true,
                deleted: false,
                role: UserRole.BASIC,
                status: UserStatus.ACTIVE,
                createdBy: { id: importedUser.importedBy },
                createdOn: new Date(),
                notificationsActive: true
              };
              try {
                user.id = await UserStorage.saveUser(tenant.id, user);
                // Role need to be set separately
                await UserStorage.saveUserRole(tenant.id, user.id, UserRole.BASIC);
                // Status need to be set separately
                await UserStorage.saveUserStatus(tenant.id, user.id, UserStatus.ACTIVE);
                await UserStorage.deleteImportedUser(tenant.id, importedUser.id);
                await Logging.logDebug({
                  tenantID: tenant.id,
                  action: ServerAction.SYNCHRONIZE_USERS,
                  module: MODULE_NAME, method: 'SYNCHRONIZE_USERS',
                  message: `User with email: ${importedUser.email} have been created in Tenant ${tenant.name}`
                });
              } catch (error) {
                importedUser.errorCode = HTTPError.GENERAL_ERROR;
                importedUser.errorDescription = error.message;
                await UserStorage.saveImportedUser(tenant.id, importedUser);
                // Error
                await Logging.logError({
                  tenantID: tenant.id,
                  action: ServerAction.SYNCHRONIZE_USERS,
                  module: MODULE_NAME, method: 'createUser',
                  message: `An error occurred when importing user with email: ${importedUser.email}`,
                  detailedMessages: { error }
                });
              }
            }
          }
          skip += Constants.EXPORT_PAGE_SIZE;
        } while (skip < count);
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.SYNCHRONIZE_USERS, error);
      } finally {
        // Release the lock
        await LockingManager.release(synchronizeUsersImport);
      }
    }
  }
}
