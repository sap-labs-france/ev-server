import AppError from '../../../exception/AppError';
import Constants from '../../../utils/Constants';
import fs from 'fs';
import global from '../../../types/GlobalType';
import SchemaValidator from './SchemaValidator';

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
    this._validateComponentDependencies(content);
    this.validate(this._tenantCreation, content);
  }

  public validateTenantUpdate(content: any): void {
    this._validateComponentDependencies(content);
    this.validate(this._tenantUpdate, content);
  }

  private _validateComponentDependencies(content: any) {
    if (content.components.smartCharging && content.components.organization) {
      if (content.components.smartCharging.active && !content.components.organization.active) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: 'Organization must be active to use smart charging',
          module: this.moduleName,
          method: 'validateTenantUpdate'
        });
      }
    }
  }
}
