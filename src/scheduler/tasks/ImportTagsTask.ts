import { ActionsResponse, ImportStatus } from '../../types/GlobalType';
import Tag, { ImportedTag } from '../../types/Tag';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DbParams from '../../types/database/DbParams';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import TagStorage from '../../storage/mongodb/TagStorage';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SynchronizeUsersImportTask';

export default class ImportTagsTask extends SchedulerTask {
  public async processTenant(tenant: Tenant, config?: TaskConfig): Promise<void> {
    const importTagsLock = await LockingHelper.createImportTagsLock(tenant.id);
    if (importTagsLock) {
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
          await Logging.logDebug({
            tenantID: tenant.id,
            action: ServerAction.IMPORT_TAGS,
            module: MODULE_NAME, method: 'processTenant',
            message: `${totalTagsToImport} Tag(s) are going to be imported...`
          });
        }
        do {
          // Get the imported tags
          importedTags = await TagStorage.getImportedTags(tenant.id, { status: ImportStatus.READY }, dbParams);
          for (const importedTag of importedTags.result) {
            try {
              // Existing tags
              const foundTag = await TagStorage.getTag(tenant.id, importedTag.id);
              if (foundTag) {
                // Update it
                await TagStorage.saveTag(tenant.id, { ...foundTag, ...importedTag });
                // Remove the imported Tag
                await TagStorage.deleteImportedTag(tenant.id, importedTag.id);
                result.inSuccess++;
                continue;
              }
              // New Tag
              const tag: Tag = {
                id: importedTag.id,
                description: importedTag.description,
                issuer: true,
                deleted: false,
                active: false,
                createdBy: { id: importedTag.importedBy },
                createdOn: importedTag.importedOn,
              };
              // Save the new Tag
              await TagStorage.saveTag(tenant.id, tag);
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
                action: ServerAction.IMPORT_TAGS,
                module: MODULE_NAME, method: 'processTenant',
                message: `An error occurred while importing the Tag ID '${importedTag.id}'`,
                detailedMessages: { error: error.message, stack: error.stack }
              });
            }
          }
          // Log
          if (importedTags.result.length > 0 && (result.inError + result.inSuccess) > 0) {
            const intermediateDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
            await Logging.logDebug({
              tenantID: tenant.id,
              action: ServerAction.IMPORT_TAGS,
              module: MODULE_NAME, method: 'processTenant',
              message: `${result.inError + result.inSuccess}/${totalTagsToImport} Tag(s) have been processed in ${intermediateDurationSecs}s...`
            });
          }
        } while (!Utils.isEmptyArray(importedTags?.result));
        // Log final results
        const executionDurationSecs = Math.round((new Date().getTime() - startTime) / 1000);
        await Logging.logActionsResponse(tenant.id, ServerAction.IMPORT_TAGS, MODULE_NAME, 'processTenant', result,
          `{{inSuccess}} Tag(s) have been imported successfully in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inError}} Tag(s) failed to be imported in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `{{inSuccess}} Tag(s) have been imported successfully but {{inError}} failed in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`,
          `Not Tag has been imported in ${executionDurationSecs}s in Tenant ${Utils.buildTenantName(tenant)}`
        );
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.IMPORT_TAGS, error);
      } finally {
        // Release the lock
        await LockingManager.release(importTagsLock);
      }
    }
  }
}
