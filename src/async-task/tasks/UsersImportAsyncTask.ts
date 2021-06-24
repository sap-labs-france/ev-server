import { ActionsResponse, ImportStatus } from '../../types/GlobalType';
import User, { ImportedUser, UserRole, UserStatus } from '../../types/User';

import AbstractAsyncTask from '../AsyncTask';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DbParams from '../../types/database/DbParams';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { ServerAction } from '../../types/Server';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'UsersImportAsyncTask';

export default class UsersImportAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const importUsersLock = await LockingHelper.createImportUsersLock(this.asyncTask.tenantID);
    if (importUsersLock) {
      const tenant = await TenantStorage.getTenant(this.asyncTask.tenantID);
      try {
        const dbParams: DbParams = { limit: Constants.IMPORT_PAGE_SIZE, skip: 0 };
        let importedUsers: DataResult<ImportedUser>;
        const result: ActionsResponse = {
          inError: 0,
          inSuccess: 0,
        };
        const startTime = new Date().getTime();
        // Get total number of Users to import
        const totalUsersToImport = await UserStorage.getImportedUsersCount(tenant.id);
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
          importedUsers = await UserStorage.getImportedUsers(tenant.id, { status: ImportStatus.READY }, dbParams);
          for (const importedUser of importedUsers.result) {
            try {
            // Existing Users
              const foundUser = await UserStorage.getUserByEmail(tenant.id, importedUser.email);
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
                await UserStorage.saveUser(tenant.id, foundUser);
                // Remove the imported User
                await UserStorage.deleteImportedUser(tenant.id, importedUser.id);
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
              newUser.status = importedUser.autoActivateAtImport ? UserStatus.ACTIVE : UserStatus.PENDING;
              // Save the new User
              newUser.id = await UserStorage.saveUser(tenant.id, newUser);
              // Role need to be set separately
              await UserStorage.saveUserRole(tenant.id, newUser.id, UserRole.BASIC);
              // Status need to be set separately
              await UserStorage.saveUserStatus(tenant.id, newUser.id, newUser.status);
              // TODO: add la gestion du assign des siteids
              await UserStorage.deleteImportedUser(tenant.id, importedUser.id);
              // Handle sending email for reseting password if user auto activated
              // Init Password info
              const resetHash = Utils.generateUUID();
              await UserStorage.saveUserPassword(tenant.id, newUser.id, { passwordResetHash: resetHash });
              if (newUser.status === UserStatus.ACTIVE) {
                // Send create password link
                const evseDashboardCreatePasswordURL = Utils.buildEvseURL(tenant.subdomain) +
                  '/define-password?hash=' + resetHash;
                // Send account created with create password notification (Async)
                await NotificationHandler.sendUserCreatePassword(
                  tenant.id,
                  Utils.generateUUID(),
                  newUser,
                  {
                    'user': newUser,
                    'tenantName': tenant.name,
                    'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain),
                    'evseDashboardCreatePasswordURL': evseDashboardCreatePasswordURL
                  });
              } else if (newUser.status === UserStatus.PENDING) {
                // Generate new verificationToken
                const verificationToken = Utils.generateToken(newUser.email);
                // Save User Verification Account
                await UserStorage.saveUserAccountVerification(tenant.id, newUser.id, { verificationToken });
                // Build account verif email with reset password embeded
                const evseDashboardVerifyEmailURL = Utils.buildEvseURL(tenant.subdomain) +
                '/verify-email?VerificationToken=' + verificationToken + '&Email=' +
                newUser.email + '&ResetToken=' + resetHash + '&isImported=true';
                // Send activate account link
                await NotificationHandler.sendVerificationEmailUserImport(
                  tenant.id,
                  Utils.generateUUID(),
                  newUser,
                  {
                    'tenantName': tenant.name,
                    'user': newUser,
                    'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain),
                    'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
                  });
              }
              result.inSuccess++;
            } catch (error) {
              importedUser.status = ImportStatus.ERROR;
              importedUser.errorDescription = error.message;
              result.inError++;
              // Update it
              await UserStorage.saveImportedUser(tenant.id, importedUser);
              // Log
              await Logging.logError({
                tenantID: tenant.id,
                action: ServerAction.USERS_IMPORT,
                module: MODULE_NAME, method: 'processTenant',
                message: `Error when importing User with email '${importedUser.email}': ${error.message}`,
                detailedMessages: { user: importedUser, error: error.message, stack: error.stack }
              });
            }
          }
          // Log
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
