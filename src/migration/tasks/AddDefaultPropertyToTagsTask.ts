import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddDefaultPropertyToTagsTask';

export default class AddDefaultPropertyToTagsTask extends MigrationTask {
    async migrate(): Promise<void> {
        const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
        for (const tenant of tenants.result) {
            await this.migrateTenant(tenant);
        }
    }

    async migrateTenant(tenant: Tenant): Promise<void> {
        // Add the active property to tags
        let updated = 0;
        // Get Tags with no Description
        const tagsMDB = await global.database.getCollection<any>(tenant.id, 'tags')
            .find({
                default: null              ,
                issuer: true,
            }).toArray();
        if (!Utils.isEmptyArray(tagsMDB)) {
            for (const tagMDB of tagsMDB) {
                await global.database.getCollection<any>(tenant.id, 'tags').findOneAndUpdate(
                    { _id: tagMDB._id },
                    { $set: { default: false } });
                updated++;
            }
        }
        // Log in the default tenant
        if (updated > 0) {
            Logging.logDebug({
                tenantID: Constants.DEFAULT_TENANT,
                module: MODULE_NAME, method: 'migrateTenant',
                action: ServerAction.MIGRATION,
                message: `${updated} Tag(s) default property have been updated in Tenant '${tenant.name}'`
            });
        }
    }

    getVersion(): string {
        return '1.0';
    }

    getName(): string {
        return 'AddDefaultPropertyToTagsTask';
    }

    isAsynchronous(): boolean {
        return true;
    }
}
