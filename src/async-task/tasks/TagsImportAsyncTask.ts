import { ActionsResponse, ImportStatus } from '../../types/GlobalType';
import Tag, { ImportedTag } from '../../types/Tag';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DbParams from '../../types/database/DbParams';
import ImportAsyncTask from './ImportAsyncTask';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';
import TagStorage from '../../storage/mongodb/TagStorage';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'TagsImportAsyncTask';

export default class TagsImportAsyncTask extends ImportAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const importTagsLock = await LockingHelper.acquireImportTagsLock(this.asyncTask.tenantID);
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
              let foundTag = await TagStorage.getTag(tenant.id, importedTag.id, { withNbrTransactions: true });
              foundTag = foundTag ? foundTag : await TagStorage.getTagByVisualID(tenant.id, importedTag.visualID);
              if (foundTag) {
                // Check tag is already in use
                if (!foundTag.issuer) {
                  throw new Error('Tag is not local to the organization');
                }
                if (foundTag.userID) {
                  throw new Error('Tag is already assigned to a user');
                }
                if (foundTag.active) {
                  throw new Error('Tag is already active');
                }
                if (foundTag.transactionsCount > 0) {
                  throw new Error(`Tag is already used in ${foundTag.transactionsCount} transaction(s)`);
                }
                if (foundTag.id !== importedTag.id) {
                  throw new Error('Tag VisualID is already assigned to another tag');
                }
                tagToSave = { ...foundTag, ...importedTag };
              } else {
                // New Tag
                tagToSave = {
                  id: importedTag.id,
                  visualID: importedTag.visualID,
                  description: importedTag.description,
                  issuer: true,
                  active: importedTag.importedData.autoActivateTagAtImport,
                  createdBy: { id: importedTag.importedBy },
                  createdOn: importedTag.importedOn,
                  importedData: importedTag.importedData
                };
              }
              // Save user if any and get the ID to assign tag
              if (importedTag.email && importedTag.name && importedTag.firstName) {
                await this.processImportedTag(tenant, importedTag, tagToSave);
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
                detailedMessages: { tag: importedTag, error: error.stack }
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

  private async processImportedTag(tenant: Tenant, importedTag: ImportedTag, tag: Tag) {
    // if user not found we create one
    const user = await this.processImportedUser(tenant, importedTag);
    tag.userID = user.id;
    await TagStorage.clearDefaultUserTag(tenant.id, user.id);
    tag.default = true;
  }
}
