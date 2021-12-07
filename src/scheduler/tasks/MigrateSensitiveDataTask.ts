import Cypher from '../../utils/Cypher';
import SchedulerTask from '../SchedulerTask';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';

export default class MigrateSensitiveDataTask extends SchedulerTask {
  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    const keySettings = await SettingStorage.getCryptoSettings(tenant);
    if (keySettings?.crypto.migrationToBeDone) {
      await Cypher.handleCryptoSettingsChange(tenant);
    }
  }
}
