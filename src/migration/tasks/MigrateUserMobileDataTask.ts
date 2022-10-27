import Tenant from '../../types/Tenant';
import TenantMigrationTask from '../TenantMigrationTask';
import global from '../../types/GlobalType';

export default class MigrateUserMobileDataTask extends TenantMigrationTask {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async migrateTenant(tenant: Tenant) {
    await global.database.getCollection<any>(tenant.id, 'users').updateMany(
      { mobileToken: { $exists: true } },
      [
        {
          $set: {
            mobileData: {
              mobileToken: '$mobileToken',
              mobileOs: '$mobileOs',
              mobileBundleID: '',
              mobileAppName: '',
              mobileVersion: '',
              mobileLastChangedOn: '$mobileLastChangedOn'
            }
          }
        },
        {
          $unset: ['mobileToken', 'mobileOs', 'mobileLastChangedOn']
        }
      ]
    );
  }

  public getVersion(): string {
    return '1.0';
  }

  public getName(): string {
    return 'MigrateUserMobileDataTask';
  }

  public isAsynchronous(): boolean {
    return true;
  }
}
