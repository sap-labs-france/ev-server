import BackendError from '../exception/BackendError';
import Tenant from './Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';

export default abstract class TenantHolder {
  private tenant: Tenant;
  private readonly tenantID: string;

  public constructor(tenantID: string, lazyLoadTenant: boolean = true) {
    this.tenantID = tenantID;
    if (!lazyLoadTenant) {
      this.getTenant();
    }
  }

  public getTenantID(): string {
    return this.tenantID;
  }

  public async getTenant(): Promise<Tenant> {
    if (!this.tenant) {
      this.tenant = await TenantStorage.getTenant(this.tenantID);
      if (!this.tenant) {
        throw new BackendError('TenantHolder#getTenant', 'TenantStorage.getTenant did not return Tenant');
      }
    }
    return this.tenant;
  }
}
