import { HttpTenantDeleteRequest, HttpTenantGetRequest, HttpTenantLogoGetRequest, HttpTenantsGetRequest } from '../../../../types/requests/HttpTenantRequest';

import AppError from '../../../../exception/AppError';
import { HTTPError } from '../../../../types/HTTPError';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import Tenant from '../../../../types/Tenant';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TenantValidatorRest extends SchemaValidator {
  private static instance: TenantValidatorRest|null = null;
  private tenantCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-create.json`, 'utf8'));
  private tenantUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-update.json`, 'utf8'));
  private tenantUpdateData: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-data-update.json`, 'utf8'));
  private tenantLogoGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-logo-get.json`, 'utf8'));
  private tenantGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-get.json`, 'utf8'));
  private tenantDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenant-delete.json`, 'utf8'));
  private tenantsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tenant/tenants-get.json`, 'utf8'));

  private constructor() {
    super('TenantValidatorRest');
  }

  public static getInstance(): TenantValidatorRest {
    if (!TenantValidatorRest.instance) {
      TenantValidatorRest.instance = new TenantValidatorRest();
    }
    return TenantValidatorRest.instance;
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

  public validateTenantUpdateDataReq(data: Record<string, unknown>): Tenant {
    const tenant: Tenant = this.validate(this.tenantUpdateData, data);
    this.validateComponentDependencies(tenant);
    return tenant;
  }

  public validateLogoGetReq(data: Record<string, unknown>): HttpTenantLogoGetRequest {
    return this.validate(this.tenantLogoGet, data);
  }

  public validateTenantGetReq(data: Record<string, unknown>): HttpTenantGetRequest {
    return this.validate(this.tenantGet, data);
  }

  public validateTenantDeleteReq(data: Record<string, unknown>): HttpTenantDeleteRequest {
    return this.validate(this.tenantDelete, data);
  }

  public validateTenantsGetReq(data: Record<string, unknown>): HttpTenantsGetRequest {
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
