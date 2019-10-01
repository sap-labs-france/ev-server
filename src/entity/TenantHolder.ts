import BackendError from '../exception/BackendError';
import Tenant from '../types/Tenant';
import TenantStorage from '../storage/mongodb/TenantStorage';
import Constants from '../utils/Constants';

export default abstract class TenantHolder {
  private tenant: Tenant;
  private readonly tenantID: string;

  public constructor(tenantID: string, lazyLoadTenant = true) {
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
        throw new BackendError({
          source: Constants.CENTRAL_SERVER,
          module: 'TenantHolder',
          method: 'getTenant',
          message: 'TenantStorage.getTenant did not return Tenant'
        });
      }
    }
    return this.tenant;
  }
}
