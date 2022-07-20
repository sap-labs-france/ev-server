import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import global from '../../types/GlobalType';

export default class UserCleanUpTask extends TenantMigrationTask {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async migrateTenant(tenant: Tenant) {
    // Clean up
    await global.database.getCollection<any>(tenant.id, 'users').updateMany(
      {}, { $unset: { lastSelectedCarID: '', lastSelectedCar: '' } });
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'UserCleanUpTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
