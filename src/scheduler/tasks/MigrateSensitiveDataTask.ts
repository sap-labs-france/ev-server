/* eslint-disable @typescript-eslint/indent */
/* eslint-disable linebreak-style */

import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import SchedulerTask from '../SchedulerTask';
import { SettingDB } from '../../types/Setting';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';

export default class MigrateSensitiveDataTask extends SchedulerTask {

    public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
        // Detect if Crypto Key changed
        await Cypher.detectConfigurationKey(tenant.id);

        // Get all settings per tenant
        const settings = await SettingStorage.getSettings(tenant.id, {},
            Constants.DB_PARAMS_MAX_LIMIT);

        // Filter settings with sensitiveData
        const reducedSettings = settings.result.filter((
            value: SettingDB) => {
            if (value.sensitiveData && value.sensitiveData.length > 0) {
                return true;
            }
        });

        // Save sensitiveData from settings in Migration collection per Tenant

        // Migrate if cryptoKey changed?
        if (reducedSettings && reducedSettings.length > 0) {
            await Cypher.migrateAllSensitiveData(tenant.id, reducedSettings);
        }
    }
}
