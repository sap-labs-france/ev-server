import TenantStorage = require('../storage/mongodb/TenantStorage');

export interface Model {

}
export abstract class TenantEntity { //TODO: Renamed from AbstractTenantEntity to TenantEntity, see where affected

  protected _tenantID: string;
  protected _tenant: Tenant;
  protected _model: Model; //TODO: Change to interface

  protected constructor(tenantID: string) {
    if (this.constructor === TenantEntity) {
      throw new TypeError('Abstract class cannot be instantiated directly');
    }
    this._tenantID = tenantID;
    this._tenant = null;
    this._model = {};
  }

  protected getTenantID(): string { //TODO: set to protected first and see if change is needed
    return this._tenantID;
  }

  private async getTenant(): Tenant {
    if (!this._tenant) {
      this._tenant = await TenantStorage.getTenant(this._tenantID);
    }
    return this._tenant;
  }

  protected getModel(): Model {
    return this._model;
  }

  //TODO: assumed string, might be wrong
  private async isComponentActive(identifier: string): Promise<boolean> { //TODO: private unless needed
    // Get the tenant
    const tenant = await this.getTenant();
    // Check
    return tenant.isComponentActive(identifier);
  }
}
