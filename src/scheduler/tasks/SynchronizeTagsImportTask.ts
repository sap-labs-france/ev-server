import Constants from '../../utils/Constants';
import DbParams from '../../types/database/DbParams';
import { HTTPError } from '../../types/HTTPError';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import Tag from '../../types/Tag';
import TagStorage from '../../storage/mongodb/TagStorage';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';

const MODULE_NAME = 'SynchronizeUsersImportTask';

export default class SynchronizeTagsImportTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    const synchronizeTagsImport = LockingManager.createExclusiveLock(tenant.id, LockEntity.TAGS, 'synchronize-tags-import');
    if (await LockingManager.acquire(synchronizeTagsImport)) {
      try {
        const dbParams: DbParams = { limit: Constants.EXPORT_PAGE_SIZE, skip: 0, onlyRecordCount: true };
        let importedTags = await TagStorage.getImportedTags(tenant.id, { withNoError: true }, dbParams);
        let count = importedTags.count;
        delete dbParams.onlyRecordCount;
        let skip = 0;
        // Limit the number of records
        if (count > Constants.EXPORT_RECORD_MAX_COUNT) {
          count = Constants.EXPORT_RECORD_MAX_COUNT;
        }
        do {
          importedTags = await TagStorage.getImportedTags(tenant.id, { withNoError: true }, dbParams);
          for (const importedTag of importedTags.result) {
            const foundTag = await TagStorage.getTag(tenant.id, importedTag.id);
            if (foundTag) {
              importedTag.errorCode = HTTPError.TAG_ALREADY_EXIST_ERROR;
              importedTag.errorDescription = `Tag with ID '${foundTag.id}' already exists`;
              await TagStorage.saveImportedTag(tenant.id, importedTag);
            } else {
              const tag: Tag = {
                id: importedTag.id,
                description: importedTag.description,
                issuer: true,
                deleted: false,
                active: false,
                createdBy: { id: importedTag.importedBy },
                createdOn: importedTag.importedOn
              };
              try {
                await TagStorage.saveTag(tenant.id, tag);
                await TagStorage.deleteImportedTag(tenant.id, importedTag.id);
                await Logging.logDebug({
                  tenantID: tenant.id,
                  action: ServerAction.SYNCHRONIZE_TAGS,
                  module: MODULE_NAME, method: 'SYNCHRONIZE_TAGS',
                  message: `Tag with id: ${importedTag.id} have been created in Tenant ${tenant.name}`
                });
              } catch (error) {
                importedTag.errorCode = HTTPError.GENERAL_ERROR;
                importedTag.errorDescription = error.message;
                await TagStorage.saveImportedTag(tenant.id, importedTag);
                // Error
                await Logging.logError({
                  tenantID: tenant.id,
                  action: ServerAction.SYNCHRONIZE_TAGS,
                  module: MODULE_NAME, method: 'createTag',
                  message: `An error occurred when importing tag with id: ${importedTag.id}`,
                  detailedMessages: { error }
                });
              }
            }
          }
          skip += Constants.EXPORT_PAGE_SIZE;
        } while (skip < count);
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.SYNCHRONIZE_TAGS, error);
      } finally {
        // Release the lock
        await LockingManager.release(synchronizeTagsImport);
      }
    }
  }
}
