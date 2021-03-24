import User, { ImportedUser, UserRole, UserStatus } from '../../types/User';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
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
        const dbParams: DbParams = { limit: Constants.IMPORT_PAGE_SIZE, skip: 0 };
        let importedUsers: DataResult<ImportedUser>;
        do {
          // Get the imported users
          importedUsers = await UserStorage.getImportedUsers(tenant.id, { status: ImportStatus.READY }, dbParams);
          for (const importedUser of importedUsers.result) {
            try {
            // Existing Users
              const foundUser = await UserStorage.getUserByEmail(tenant.id, importedUser.email);
              if (foundUser) {
                // Update it
                foundUser.name = importedUser.name;
                foundUser.firstName = importedUser.firstName;
                await UserStorage.saveUser(tenant.id, foundUser);
                // Remove the imported User
                await UserStorage.deleteImportedUser(tenant.id, importedUser.id);
                // Log
                await Logging.logDebug({
                  tenantID: tenant.id,
                  action: ServerAction.SYNCHRONIZE_USERS,
                  module: MODULE_NAME, method: 'processTenant',
                  message: `User with email '${importedUser.email}' have been updated successfully in Tenant ${Utils.buildTenantName(tenant)}`
                });
                continue;
              }
              // New User
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
                createdOn: importedUser.importedOn,
                notificationsActive: true
              };
              // Save the new User
              user.id = await UserStorage.saveUser(tenant.id, user);
              // Role need to be set separately
              await UserStorage.saveUserRole(tenant.id, user.id, UserRole.BASIC);
              // Status need to be set separately
              await UserStorage.saveUserStatus(tenant.id, user.id, UserStatus.ACTIVE);
              // Remove the imported User
              await UserStorage.deleteImportedUser(tenant.id, importedUser.id);
              // Log
              await Logging.logDebug({
                tenantID: tenant.id,
                action: ServerAction.SYNCHRONIZE_USERS,
                module: MODULE_NAME, method: 'processTenant',
                message: `User with email '${importedUser.email}' have been created in Tenant ${Utils.buildTenantName(tenant)}`
              });
            } catch (error) {
              importedUser.status = ImportStatus.ERROR;
              importedUser.errorDescription = error.message;
              // Update it
              await UserStorage.saveImportedUser(tenant.id, importedUser);
              // Error
              await Logging.logError({
                tenantID: tenant.id,
                action: ServerAction.SYNCHRONIZE_USERS,
                module: MODULE_NAME, method: 'processTenant',
                message: `An error occurred when importing user with email '${importedUser.email}'`,
                detailedMessages: { error: error.message, stack: error.stack }
              });
            }
          }
        } while (!Utils.isEmptyArray(importedUsers?.result));
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
