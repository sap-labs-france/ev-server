import { HttpVerifyTenantRequest } from '../../../../types/requests/HttpTenantRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class CommonValidatorRest extends SchemaValidator {
  private static instance: CommonValidatorRest | null = null;
  private verifyTenantIdSubdomain: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/common/verify-tenant-id-subdomain.json`, 'utf8'));

  private constructor() {
    super('CommonValidatorRest');
  }

  public static getInstance(): CommonValidatorRest {
    if (!CommonValidatorRest.instance) {
      CommonValidatorRest.instance = new CommonValidatorRest();
    }
    return CommonValidatorRest.instance;
  }

  public validateAuthVerifyTenantRedirectReq(data: Record<string, unknown>): Partial<HttpVerifyTenantRequest> {
    return this.validate(this.verifyTenantIdSubdomain, data);
  }
}
