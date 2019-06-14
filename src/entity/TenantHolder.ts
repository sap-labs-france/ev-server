import TenantStorage from '../storage/mongodb/TenantStorage';
import Tenant from './Tenant';
import BackendError from '../exception/BackendError';

export default abstract class TenantHolder {
  private tenant: Tenant;

  public constructor(readonly tenantID: string, lazyLoadTenant: boolean = true) {
    if (!lazyLoadTenant) {
      this.getTenant();
    }
  }

  public getTenantID(): string {
    return this.tenantID;
  }

  public async getTenant(): Promise<Tenant> {
    if (this.tenant == null) {
      this.tenant = await TenantStorage.getTenant(this.tenantID);
      if (this.tenant == null) {
        throw new BackendError("TenantHolder#getTenant", "TenantStorage.getTenant did not return Tenant");
      }
    }
    return this.tenant;
  }
}
