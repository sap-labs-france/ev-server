import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import global from '../../types/GlobalType';

export default class OCPIEndpointCleanUpTask extends TenantMigrationTask {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async migrateTenant(tenant: Tenant) {
    // Clean up
    await global.database.getCollection<any>(tenant.id, 'ocpiendpoints').updateMany(
      {}, { $unset: { lastPatchJobOn: '', lastPatchJobResult: '' } });
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'OCPIEndpointCleanUpTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
