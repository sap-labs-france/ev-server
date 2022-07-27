import Constants from '../../utils/Constants';
import MigrationTask from '../MigrationTask';
import global from '../../types/GlobalType';

export default class RemoveLogoFromTenantTask extends MigrationTask {
  public async migrate() {
    // Clean up
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'tenants').updateMany(
      {},
      { $unset: { logo: '' } }
    );
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'RemoveLogoFromTenantTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
