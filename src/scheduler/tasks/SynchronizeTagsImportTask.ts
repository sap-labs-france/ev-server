import Constants from '../../utils/Constants';
import { ImportStatus } from '../../types/GlobalType';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import Tag from '../../types/Tag';
import TagStorage from '../../storage/mongodb/TagStorage';
import TagValidator from '../../server/rest/v1/validator/TagValidation';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';

const MODULE_NAME = 'SynchronizeUsersImportTask';

export default class SynchronizeTagsImportTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    const synchronizeTagsImport = LockingManager.createExclusiveLock(tenant.id, LockEntity.TAGS, 'synchronize-tags-import');
    if (await LockingManager.acquire(synchronizeTagsImport)) {
      try {
        const importedTags = await TagStorage.getImportedTags(tenant.id, { statuses: [ImportStatus.UNKNOWN] }, Constants.DB_PARAMS_MAX_LIMIT);
        if (importedTags.count !== 0) {
          for (const importedTag of importedTags.result) {
            const foundTag = await TagStorage.getTag(tenant.id, importedTag.id);
            if (foundTag) {
              importedTag.status = ImportStatus.ERROR;
              importedTag.error = 'Tag id already exists';
              await TagStorage.saveImportedTag(tenant.id, importedTag);
            } else {
              const tag: Tag = {
                id: importedTag.id,
                description: importedTag.description,
                issuer: true,
                deleted: false,
                active: true,
                createdBy: { id: importedTag.importedBy },
                createdOn: new Date()
              };
              try {
                TagValidator.getInstance().validateTagCreation(tag);
                await TagStorage.saveTag(tenant.id, tag);
                importedTag.status = ImportStatus.IMPORTED;
                await TagStorage.saveImportedTag(tenant.id, importedTag);
                await Logging.logDebug({
                  tenantID: tenant.id,
                  action: ServerAction.SYNCHRONIZE_TAGS,
                  module: MODULE_NAME, method: 'SYNCHRONIZE_TAGS',
                  message: `Tag with id: ${importedTag.id} have been created in Tenant ${tenant.name}`
                });
              } catch (error) {
                importedTag.status = ImportStatus.ERROR;
                importedTag.error = error.message;
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
        }
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
