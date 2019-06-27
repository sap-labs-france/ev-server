import fs from 'fs';
import TSGlobal from '../../../types/GlobalType';
import SchemaValidator from './SchemaValidator';
declare const global: TSGlobal;

export default class TenantValidator extends SchemaValidator {

  private static _instance: TenantValidator | undefined;
  private _tenantCreation: any;
  private _tenantUpdate: any;

  private constructor() {
    super('TenantValidator');
    this._tenantCreation = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/schemas/tenant/tenant-creation.json`, 'utf8'));
    this._tenantUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/schemas/tenant/tenant-update.json`, 'utf8'));
  }

  public static getInstance(): TenantValidator {
    if (!TenantValidator._instance) {
      TenantValidator._instance = new TenantValidator();
    }
    return TenantValidator._instance;
  }


  public validateTenantCreation(content: any): void {
    this.validate(this._tenantCreation, content);
  }

  public validateTenantUpdate(content: any): void {
    this.validate(this._tenantUpdate, content);
  }
}
