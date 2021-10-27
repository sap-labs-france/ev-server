import { HttpTenantLogoRequest, HttpTenantRequest, HttpTenantsRequest } from '../../../../types/requests/HttpTenantRequest';

import AppError from '../../../../exception/AppError';
import { HTTPError } from '../../../../types/HTTPError';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import Tenant from '../../../../types/Tenant';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TenantValidator extends SchemaValidator {
  private static instance: TenantValidator|null = null;
  private tenantCreate: Schema;
  private tenantUpdate: Schema;
  private tenantLogoGet: Schema;
  private tenantGet: Schema;
  private tenantsGet: Schema;

  private constructor() {
    super('TenantValidator');
    this.tenantCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-create.json`, 'utf8'));
    this.tenantUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-update.json`, 'utf8'));
    this.tenantGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-get.json`, 'utf8'));
    this.tenantsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenants-get.json`, 'utf8'));
    this.tenantLogoGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-logo-get.json`, 'utf8'));
  }

  public static getInstance(): TenantValidator {
    if (!TenantValidator.instance) {
      TenantValidator.instance = new TenantValidator();
    }
    return TenantValidator.instance;
  }

  public validateTenantCreateReq(data: Record<string, unknown>): Tenant {
    const tenant: Tenant = this.validate(this.tenantCreate, data);
    this.validateComponentDependencies(tenant);
    return tenant;
  }

  public validateTenantUpdateReq(data: Record<string, unknown>): Tenant {
    const tenant: Tenant = this.validate(this.tenantUpdate, data);
    this.validateComponentDependencies(tenant);
    return tenant;
  }

  public validateLogoGetReq(data: Record<string, unknown>): HttpTenantLogoRequest {
    return this.validate(this.tenantLogoGet, data);
  }

  public validateTenantGetReq(data: Record<string, unknown>): HttpTenantRequest {
    return this.validate(this.tenantGet, data);
  }

  public validateTenantsGetReq(data: Record<string, unknown>): HttpTenantsRequest {
    return this.validate(this.tenantsGet, data);
  }

  private validateComponentDependencies(tenant: Tenant): void {
    if (tenant.components) {
      // Both OICP and OCPI cannot be active
      if (tenant.components.oicp && tenant.components.ocpi &&
          tenant.components.oicp.active && tenant.components.ocpi.active) {
        throw new AppError({
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Both OICP and OCPI roaming components cannot be active',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
      // Smart Charging active: Organization must be active
      if (tenant.components.smartCharging && tenant.components.organization &&
          tenant.components.smartCharging.active && !tenant.components.organization.active) {
        throw new AppError({
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Organization must be active to use the Smart Charging component',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
      // Asset active: Organization must be active
      if (tenant.components.asset && tenant.components.organization &&
        tenant.components.asset.active && !tenant.components.organization.active) {
        throw new AppError({
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Organization must be active to use the Asset component',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
      // Car Connector active: Car must be active
      if (tenant.components.carConnector && tenant.components.car &&
        tenant.components.carConnector.active && !tenant.components.car.active) {
        throw new AppError({
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Car must be active to use the Car Connector component',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
      // Billing active: Pricing must be active
      if (tenant.components.billing && tenant.components.pricing &&
          tenant.components.billing.active && !tenant.components.pricing.active) {
        throw new AppError({
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Pricing must be active to use the Billing component',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
      // Refund active: Pricing must be active
      if (tenant.components.refund && tenant.components.pricing &&
          tenant.components.refund.active && !tenant.components.pricing.active) {
        throw new AppError({
          errorCode: HTTPError.GENERAL_ERROR,
          message: 'Pricing must be active to use the Refund component',
          module: this.moduleName, method: 'validateComponentDependencies'
        });
      }
    }
  }
}
