import User, { UserRole, UserStatus } from '../../types/User';

import Constants from '../../utils/Constants';
import DbParams from '../../types/database/DbParams';
import { ImportStatus } from '../../types/GlobalType';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SynchronizeUsersImportTask';

export default class SynchronizeUsersImportTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    const synchronizeUsersImport = LockingManager.createExclusiveLock(tenant.id, LockEntity.USER, 'synchronize-users-import');
    if (await LockingManager.acquire(synchronizeUsersImport)) {
      try {
        const dbParams: DbParams = { limit: Constants.EXPORT_PAGE_SIZE, skip: 0 };
        let importedUsers = await UserStorage.getImportedUsers(tenant.id, { status: ImportStatus.READY }, dbParams);
        while (importedUsers && !Utils.isEmptyArray(importedUsers.result)) {
          for (const importedUser of importedUsers.result) {
            const foundUser = await UserStorage.getUserByEmail(tenant.id, importedUser.email);
            if (foundUser) {
              importedUser.status = ImportStatus.ERROR;
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
                  message: `User with email: ${importedUser.email} have been created in Tenant ${Utils.buildTenantName(tenant)}`
                });
              } catch (error) {
                importedUser.status = ImportStatus.ERROR;
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
          importedUsers = await UserStorage.getImportedUsers(tenant.id, { status: ImportStatus.READY }, dbParams);
        }
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
