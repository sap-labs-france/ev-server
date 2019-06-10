import SchemaValidator from './SchemaValidator';
import tenantCreation from '../schemas/tenant/tenant-creation.json';
import tenantUpdate from '../schemas/tenant/tenant-update.json';

export default class TenantValidator extends SchemaValidator {

  private static instance: TenantValidator | undefined = undefined;

  private constructor() {
    super("TenantValidator");
  }

  public static getInstance(): TenantValidator {
    if(!TenantValidator.instance) {
      TenantValidator.instance = new TenantValidator();
    }
    return TenantValidator.instance;
  }


  public validateTenantCreation(content: any): void {
    this.validate(tenantCreation, content);
  }

  public validateTenantUpdate(content: any): void {
    this.validate(tenantUpdate, content);
  }
}
