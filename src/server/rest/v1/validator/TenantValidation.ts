import { HttpTenantLogoRequest, HttpTenantsRequest } from '../../../../types/requests/HttpTenantRequest';

import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import Schema from './Schema';
import SchemaValidator from './SchemaValidator';
import Tenant from '../../../../types/Tenant';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TenantValidator extends SchemaValidator {
  private static _instance: TenantValidator | undefined;
  private tenantCreateReqSuperAdmin: Schema;
  private tenantUpdateReqSuperAdmin: Schema;
  private tenantDeleteReqSuperAdmin: Schema;
  private tenantGetLogoReqSuperAdmin: Schema;
  private tenantGetReqSuperAdmin: Schema;
  private tenantsGetReqSuperAdmin: Schema;

  private constructor() {
    super('TenantValidator');
    this.tenantCreateReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-create-req-super-admin.json`, 'utf8'));
    this.tenantUpdateReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-update-req-super-admin.json`, 'utf8'));
    this.tenantDeleteReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-delete-req-super-admin.json`, 'utf8'));
    this.tenantGetReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-get-req-super-admin.json`, 'utf8'));
    this.tenantsGetReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenants-get-req-super-admin.json`, 'utf8'));
    this.tenantGetLogoReqSuperAdmin = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-get-logo-req-super-admin.json`, 'utf8'));
  }

  public static getInstance(): TenantValidator {
    if (!TenantValidator._instance) {
      TenantValidator._instance = new TenantValidator();
    }
    return TenantValidator._instance;
  }

  public validateTenantCreateRequestSuperAdmin(tenant: Tenant): Tenant {
    // Validate schema
    this.validate(this.tenantCreateReqSuperAdmin, tenant);
    // Validate deps between components
    this.validateComponentDependencies(tenant);
    return tenant;
  }

  public validateTenantUpdateRequestSuperAdmin(tenant: Tenant): Tenant {
    // Validate schema
    this.validate(this.tenantUpdateReqSuperAdmin, tenant);
    // Validate deps between components
    this.validateComponentDependencies(tenant);
    return tenant;
  }

  public validateTenantDeleteRequestSuperAdmin(data: any): string {
    // Validate schema
    this.validate(this.tenantDeleteReqSuperAdmin, data);
    return data.ID;
  }

  public validateGetLogoReqSuperAdmin(data: any): HttpTenantLogoRequest {
    // Validate schema
    this.validate(this.tenantGetLogoReqSuperAdmin, data);
    return data;
  }

  public validateTenantGetReqSuperAdmin(data: any): string {
    // Validate schema
    this.validate(this.tenantGetReqSuperAdmin, data);
    return data.ID;
  }

  public validateTenantsGetReqSuperAdmin(data: any): HttpTenantsRequest {
    // Validate schema
    this.validate(this.tenantsGetReqSuperAdmin, data);
    return data;
  }

  private validateComponentDependencies(tenant: Tenant) {
    if (tenant.components) {
      // Smart Charging active: Organization must be active
      if (tenant.components.smartCharging && tenant.components.organization &&
          tenant.components.smartCharging.active && !tenant.components.organization.active) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Organization must be active to use the Smart Charging component',
          module: this.moduleName, method: 'validateTenantUpdateRequestSuperAdmin'
        });
      }
      // Asset active: Organization must be active
      if (tenant.components.asset && tenant.components.organization &&
        tenant.components.asset.active && !tenant.components.organization.active) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Organization must be active to use the Asset component',
          module: this.moduleName, method: 'validateTenantUpdateRequestSuperAdmin'
        });
      }
      // Billing active: Pricing must be active
      if (tenant.components.billing && tenant.components.pricing &&
          tenant.components.billing.active && !tenant.components.pricing.active) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Pricing must be active to use the Billing component',
          module: this.moduleName, method: 'validateTenantUpdateRequestSuperAdmin'
        });
      }
      // Refund active: Pricing must be active
      if (tenant.components.refund && tenant.components.pricing &&
          tenant.components.refund.active && !tenant.components.pricing.active) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Pricing must be active to use the Refund component',
          module: this.moduleName, method: 'validateTenantUpdateRequestSuperAdmin'
        });
      }
    }
  }
}
