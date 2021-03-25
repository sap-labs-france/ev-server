import Tag, { ImportedTag } from '../../types/Tag';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DbParams from '../../types/database/DbParams';
import { ImportStatus } from '../../types/GlobalType';
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
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    const importTagsLock = await LockingHelper.createImportTagsLock(tenant.id);
    if (importTagsLock) {
      try {
        const dbParams: DbParams = { limit: Constants.IMPORT_PAGE_SIZE, skip: 0 };
        let importedTags: DataResult<ImportedTag>;
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
                // Log
                await Logging.logDebug({
                  tenantID: tenant.id,
                  action: ServerAction.SYNCHRONIZE_TAGS,
                  module: MODULE_NAME, method: 'processTenant',
                  message: `Tag ID '${importedTag.id}' has been updated successfully in Tenant ${Utils.buildTenantName(tenant)}`
                });
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
              // Log
              await Logging.logDebug({
                tenantID: tenant.id,
                action: ServerAction.SYNCHRONIZE_TAGS,
                module: MODULE_NAME, method: 'processTenant',
                message: `Tag ID '${importedTag.id}' have been created in Tenant ${Utils.buildTenantName(tenant)}`
              });
            } catch (error) {
              // Update the imported Tag
              importedTag.status = ImportStatus.ERROR;
              importedTag.errorDescription = error.message;
              // Update it
              await TagStorage.saveImportedTag(tenant.id, importedTag);
              // Log
              await Logging.logError({
                tenantID: tenant.id,
                action: ServerAction.SYNCHRONIZE_TAGS,
                module: MODULE_NAME, method: 'processTenant',
                message: `An error occurred while importing the Tag ID '${importedTag.id}'`,
                detailedMessages: { error: error.message, stack: error.stack }
              });
            }
          }
        } while (!Utils.isEmptyArray(importedTags?.result));
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.SYNCHRONIZE_TAGS, error);
      } finally {
        // Release the lock
        await LockingManager.release(importTagsLock);
      }
    }
  }
}
