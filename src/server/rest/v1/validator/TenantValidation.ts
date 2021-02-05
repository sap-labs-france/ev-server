import { HttpTenantLogoRequest, HttpTenantsRequest } from '../../../../types/requests/HttpTenantRequest';

import AppError from '../../../../exception/AppError';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import OICPEndpointStorage from '../../../../storage/mongodb/OICPEndpointStorage';
import { OICPRole } from '../../../../types/oicp/OICPRole';
import OICPUtils from '../../../oicp/OICPUtils';
import Schema from './Schema';
import SchemaValidator from './SchemaValidator';
import Tenant from '../../../../types/Tenant';
import UserStorage from '../../../../storage/mongodb/UserStorage';
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

  public async validateTenantCreateRequestSuperAdmin(tenant: Tenant): Promise<Tenant> {
    // Validate schema
    this.validate(this.tenantCreateReqSuperAdmin, tenant);
    // Validate deps between components
    await this.validateComponentDependencies(tenant);
    return tenant;
  }

  public async validateTenantUpdateRequestSuperAdmin(tenant: Tenant): Promise<Tenant> {
    // Validate schema
    this.validate(this.tenantUpdateReqSuperAdmin, tenant);
    // Validate deps between components
    await this.validateComponentDependencies(tenant);
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

  private async validateComponentDependencies(tenant: Tenant): Promise<void> {
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
      // OICP
      if (tenant.components.oicp) {
        const checkOICPComponent = tenant.components.oicp;
        // Virtual user needed for unknown roaming user
        const virtualOICPUser = await UserStorage.getUserByEmail(tenant.id, Constants.OICP_VIRTUAL_USER_EMAIL);
        // Activate or deactivate virtual user depending on the oicp component status
        if (checkOICPComponent.active) {
          // Create OICP user
          if (!virtualOICPUser) {
            await OICPUtils.createOICPVirtualUser(tenant.id);
          }
        } else {
          // Clean up user
          if (virtualOICPUser) {
            await UserStorage.deleteUser(tenant.id, virtualOICPUser.id);
          }
          // Delete Endpoints if component is inactive
          const oicpEndpoints = await OICPEndpointStorage.getOicpEndpoints(tenant.id, { role: OICPRole.CPO }, Constants.DB_PARAMS_MAX_LIMIT);
          oicpEndpoints.result.forEach(async (oicpEndpoint) => {
            await OICPEndpointStorage.deleteOicpEndpoint(tenant.id, oicpEndpoint.id);
          });
        }
      }
    }
  }
}
