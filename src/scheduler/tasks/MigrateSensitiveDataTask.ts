import Cypher from '../../utils/Cypher';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import TenantSchedulerTask from '../TenantSchedulerTask';

export default class MigrateSensitiveDataTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    const keySettings = await SettingStorage.getCryptoSettings(tenant);
    if (keySettings?.crypto.migrationToBeDone) {
      await Cypher.handleCryptoSettingsChange(tenant);
    }
  }
}
