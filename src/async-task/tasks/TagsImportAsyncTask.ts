import { ActionsResponse, ImportStatus } from '../../types/GlobalType';
import Tag, { ImportedTag } from '../../types/Tag';
import User, { UserRole, UserStatus } from '../../types/User';

import AbstractAsyncTask from '../AsyncTask';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DbParams from '../../types/database/DbParams';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import TagStorage from '../../storage/mongodb/TagStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'TagsImportAsyncTask';

export default class TagsImportAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const importTagsLock = await LockingHelper.createImportTagsLock(this.asyncTask.tenantID);
    if (importTagsLock) {
      const tenant = await TenantStorage.getTenant(this.asyncTask.tenantID);
      try {
        const dbParams: DbParams = { limit: Constants.IMPORT_PAGE_SIZE, skip: 0 };
        let importedTags: DataResult<ImportedTag>;
        const result: ActionsResponse = {
          inError: 0,
          inSuccess: 0,
        };
        const startTime = new Date().getTime();
        // Get total number of Tags to import
        const totalTagsToImport = await TagStorage.getImportedTagsCount(tenant.id);
        if (totalTagsToImport > 0) {
          await Logging.logInfo({
            tenantID: tenant.id,
            action: ServerAction.TAGS_IMPORT,
            module: MODULE_NAME, method: 'processTenant',
            message: `${totalTagsToImport} Tag(s) are going to be imported...`
          });
        }
        do {
          // Get the imported tags
          importedTags = await TagStorage.getImportedTags(tenant.id, { status: ImportStatus.READY }, dbParams);
          let tagToSave: Tag;
          for (const importedTag of importedTags.result) {
            try {
              // Existing tags
              const foundTag = await TagStorage.getTag(tenant.id, importedTag.id, { withNbrTransactions: true });
              if (foundTag) {
                // Check tag is already in use
                if (!foundTag.issuer) {
                  throw new Error('Tag is not local to the organization');
                }
                if (foundTag.userID) {
                  throw new Error('Tag is already assigned to an user');
                }
                if (foundTag.active) {
                  throw new Error('Tag is already active');
                }
                if (foundTag.transactionsCount > 0) {
                  throw new Error(`Tag is already used in ${foundTag.transactionsCount} transaction(s)`);
                }
                tagToSave = { ...foundTag, ...importedTag };
              } else {
                // New Tag
                tagToSave = {
                  id: importedTag.id,
                  description: importedTag.description,
                  issuer: true,
                  active: false,
                  createdBy: { id: importedTag.importedBy },
                  createdOn: importedTag.importedOn,
                };
              }
              // Save user if any and get the ID to assign tag
              if (importedTag.email && importedTag.name && importedTag.firstName) {
                await this.assignTag(tenant, importedTag, tagToSave);
              }
              // Save the new Tag
              await TagStorage.saveTag(tenant.id, tagToSave);
              // Remove the imported Tag
              await TagStorage.deleteImportedTag(tenant.id, importedTag.id);
              result.inSuccess++;
            } catch (error) {
              // Update the imported Tag
              importedTag.status = ImportStatus.ERROR;
              importedTag.errorDescription = error.message;
              result.inError++;
              // Update it
              await TagStorage.saveImportedTag(tenant.id, importedTag);
              // Log
              await Logging.logError({
                tenantID: tenant.id,
                action: ServerAction.TAGS_IMPORT,
                module: MODULE_NAME, method: 'processTenant',
                message: `Error when importing Tag ID '${importedTag.id}': ${error.message}`,
                detailedMessages: { tag: importedTag, error: error.message, stack: error.stack }
              });
            }
          }
          // Log
          if (!Utils.isEmptyArray(importedTags.result) && (result.inError + result.inSuccess) > 0) {
            const intermediateDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
            await Logging.logDebug({
              tenantID: tenant.id,
              action: ServerAction.TAGS_IMPORT,
              module: MODULE_NAME, method: 'processTenant',
              message: `${result.inError + result.inSuccess}/${totalTagsToImport} Tag(s) have been processed in ${intermediateDurationSecs}s...`
            });
          }
        } while (!Utils.isEmptyArray(importedTags?.result));
        // Log final results
        const executionDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
        await Logging.logActionsResponse(tenant.id, ServerAction.TAGS_IMPORT, MODULE_NAME, 'processTenant', result,
          `{{inSuccess}} Tag(s) have been imported successfully in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inError}} Tag(s) failed to be imported in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inSuccess}} Tag(s) have been imported successfully but {{inError}} failed in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `Not Tag has been imported in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`
        );
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.TAGS_IMPORT, error);
      } finally {
        // Release the lock
        await LockingManager.release(importTagsLock);
      }
    }
  }

  private async assignTag(tenant: Tenant, importedTag: ImportedTag, tag: Tag) {
    // Save user if any and get the ID to assign tag
    const foundUser = await UserStorage.getUserByEmail(tenant.id,importedTag.email);
    if (!foundUser) {
      const user = {
        name: importedTag.name,
        firstName: importedTag.firstName,
        email: importedTag.email,
        createdBy: { id: importedTag.importedBy },
        createdOn: Utils.convertToDate(importedTag.importedOn),
        issuer: true,
        status: UserStatus.PENDING,
        role: UserRole.BASIC,
      } as User;
      const userID = await UserStorage.saveUser(tenant.id, user);
      await UserStorage.saveUserStatus(tenant.id, userID, user.status);
      await UserStorage.saveUserRole(tenant.id, userID, user.role);
      tag.userID = userID;
    } else {
      tag.userID = foundUser.id;
    }
  }
}
