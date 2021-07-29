import { ActionsResponse, ImportStatus } from '../../types/GlobalType';

import AbstractAsyncTask from '../AsyncTask';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DbParams from '../../types/database/DbParams';
import ImportHelper from './ImportHelper';
import { ImportedUser } from '../../types/User';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import Site from '../../types/Site';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'UsersImportAsyncTask';

export default class UsersImportAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const importUsersLock = await LockingHelper.acquireImportUsersLock(this.asyncTask.tenantID);
    const importHelper = new ImportHelper();
    const existingSites: Map<string, Site> = new Map();
    if (importUsersLock) {
      const tenant = await TenantStorage.getTenant(this.asyncTask.tenantID);
      try {
        if (existingSites.size === 0) {
          const sites = await SiteStorage.getSites(tenant, {}, Constants.DB_PARAMS_MAX_LIMIT, ['id', 'name']);
          for (const site of sites.result) {
            existingSites.set(site.id, site);
          }
        }
        const dbParams: DbParams = { limit: Constants.IMPORT_PAGE_SIZE, skip: 0 };
        let importedUsers: DataResult<ImportedUser>;
        const result: ActionsResponse = {
          inError: 0,
          inSuccess: 0,
        };
        const startTime = new Date().getTime();
        // Get total number of Users to import
        const totalUsersToImport = await UserStorage.getImportedUsersCount(tenant);
        if (totalUsersToImport > 0) {
          await Logging.logInfo({
            tenantID: tenant.id,
            action: ServerAction.USERS_IMPORT,
            module: MODULE_NAME, method: 'processTenant',
            message: `${totalUsersToImport} User(s) are going to be imported...`
          });
        }
        do {
          // Get the imported users
          importedUsers = await UserStorage.getImportedUsers(tenant, { status: ImportStatus.READY }, dbParams);
          for (const importedUser of importedUsers.result) {
            try {
            // Existing Users
              const foundUser = await UserStorage.getUserByEmail(tenant, importedUser.email);
              if (foundUser) {
                // Check tag is already in use
                if (!foundUser.issuer) {
                  throw new Error('User is not local to the organization');
                }
                if (foundUser.status !== UserStatus.PENDING) {
                  throw new Error('User account is already in use');
                }
                // Update it
                foundUser.name = importedUser.name;
                foundUser.firstName = importedUser.firstName;
                await UserStorage.saveUser(tenant, foundUser);
                // Remove the imported User
                await UserStorage.deleteImportedUser(tenant, importedUser.id);
                result.inSuccess++;
                continue;
              }
              // New User
              const newUser = UserStorage.createNewUser() as User;
              // Set
              newUser.firstName = importedUser.firstName;
              newUser.name = importedUser.name;
              newUser.email = importedUser.email;
              newUser.createdBy = { id: importedUser.importedBy };
              newUser.createdOn = importedUser.importedOn;
              // Save the new User
              newUser.id = await UserStorage.saveUser(tenant, newUser);
              // Role need to be set separately
              await UserStorage.saveUserRole(tenant, newUser.id, UserRole.BASIC);
              // Status need to be set separately
              await UserStorage.saveUserStatus(tenant, newUser.id, UserStatus.PENDING);
              // Remove the imported User
              await UserStorage.deleteImportedUser(tenant, importedUser.id);
              result.inSuccess++;
            } catch (error) {
              // Mark the imported User faulty with the reason
              importedUser.status = ImportStatus.ERROR;
              importedUser.errorDescription = error.message;
              result.inError++;
              // Update it
              await UserStorage.saveImportedUser(tenant, importedUser);
              // Log
              await Logging.logError({
                tenantID: tenant.id,
                action: ServerAction.USERS_IMPORT,
                module: MODULE_NAME, method: 'executeAsyncTask',
                message: `Cannot import User with email '${importedUser.email}': ${error.message}`,
                detailedMessages: { importedUser, error: error.stack }
              });
            }
          }
          if (importedUsers.result.length > 0 && (result.inError + result.inSuccess) > 0) {
            const intermediateDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
            await Logging.logDebug({
              tenantID: tenant.id,
              action: ServerAction.USERS_IMPORT,
              module: MODULE_NAME, method: 'processTenant',
              message: `${result.inError + result.inSuccess}/${totalUsersToImport} User(s) have been processed in ${intermediateDurationSecs}s...`
            });
          }
        } while (!Utils.isEmptyArray(importedUsers?.result));
        // Log final results
        const executionDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
        await Logging.logActionsResponse(tenant.id, ServerAction.USERS_IMPORT, MODULE_NAME, 'processTenant', result,
          `{{inSuccess}} User(s) have been imported successfully in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inError}} User(s) failed to be imported in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inSuccess}} User(s) have been imported successfully but {{inError}} failed in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `Not User has been imported in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`
        );
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.USERS_IMPORT, error);
      } finally {
        // Release the lock
        await LockingManager.release(importUsersLock);
      }
    }
  }
}
