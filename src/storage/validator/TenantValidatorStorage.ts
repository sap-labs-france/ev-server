import Schema from '../../types/validator/Schema';
import SchemaValidator from '../../validator/SchemaValidator';
import Tenant from '../../types/Tenant';
import fs from 'fs';
import global from '../../types/GlobalType';

export default class TenantValidatorStorage extends SchemaValidator {
  private static instance: TenantValidatorStorage | null = null;
  private tenantSave: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/storage/schemas/tenant/tenant-save.json`, 'utf8'));

  private constructor() {
    super('TenantValidatorStorage');
  }

  public static getInstance(): TenantValidatorStorage {
    if (!TenantValidatorStorage.instance) {
      TenantValidatorStorage.instance = new TenantValidatorStorage();
    }
    return TenantValidatorStorage.instance;
  }

  public validateTenantSave(data: Record<string, unknown>): Tenant {
    return this.validate(this.tenantSave, data, true);
  }
}
