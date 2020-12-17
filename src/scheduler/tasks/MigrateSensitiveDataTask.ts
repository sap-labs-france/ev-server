import Cypher from '../../utils/Cypher';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';

export default class MigrateSensitiveDataTask extends SchedulerTask {

    public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
        await Cypher.detectConfigurationKey(tenant.id);
        // Store sensitive data before migration

        // migrate if cryptoKey changed?
        await Cypher.migrateSensitiveData(tenant.id);
    }
}
