import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import { DataResult } from '../../../../types/DataResult';
import { HttpTenantVerifyRequest, HttpTenantsRequest } from '../../../../types/requests/HttpTenantRequest';
import Tenant from '../../../../types/Tenant';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import Utils from '../../../../utils/Utils';

export default class TenantSecurity {
  public static filterTenantRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterVerifyTenantRequest(request: any): HttpTenantVerifyRequest {
    return { tenant: sanitize(request.tenant) };
  }

  public static filterTenantsRequest(request: any): HttpTenantsRequest {
    const filteredRequest: HttpTenantsRequest = {} as HttpTenantsRequest;
    filteredRequest.Search = sanitize(request.Search);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterTenantRequest(request: any): Partial<Tenant> {
    const filteredRequest: Partial<Tenant> = {};
    if ('id' in request) {
      filteredRequest.id = sanitize(request.id);
    }
    filteredRequest.name = sanitize(request.name);
    filteredRequest.subdomain = sanitize(request.subdomain);
    filteredRequest.email = sanitize(request.email);
    if (request.components) {
      filteredRequest.components = {};
      if (request.components.analytics) {
        filteredRequest.components.analytics = {
          active: UtilsSecurity.filterBoolean(request.components.analytics.active),
          type: sanitize(request.components.analytics.type)
        };
      }
      if (request.components.billing) {
        filteredRequest.components.billing = {
          active: UtilsSecurity.filterBoolean(request.components.billing.active),
          type: sanitize(request.components.billing.type)
        };
      }
      if (request.components.ocpi) {
        filteredRequest.components.ocpi = {
          active: UtilsSecurity.filterBoolean(request.components.ocpi.active),
          type: sanitize(request.components.ocpi.type)
        };
      }
      if (request.components.organization) {
        filteredRequest.components.organization = {
          active: UtilsSecurity.filterBoolean(request.components.organization.active)
        };
      }
      if (request.components.pricing) {
        filteredRequest.components.pricing = {
          active: UtilsSecurity.filterBoolean(request.components.pricing.active),
          type: sanitize(request.components.pricing.type)
        };
      }
      if (request.components.refund) {
        filteredRequest.components.refund = {
          active: UtilsSecurity.filterBoolean(request.components.refund.active),
          type: sanitize(request.components.refund.type)
        };
      }
      if (request.components.smartCharging) {
        filteredRequest.components.smartCharging = {
          active: UtilsSecurity.filterBoolean(request.components.smartCharging.active),
          type: sanitize(request.components.smartCharging.type)
        };
      }
      if (request.components.statistics) {
        filteredRequest.components.statistics = {
          active: UtilsSecurity.filterBoolean(request.components.statistics.active),
          type: sanitize(request.components.statistics.type)
        };
      }
      if (request.components.building) {
        filteredRequest.components.building = {
          active: UtilsSecurity.filterBoolean(request.components.building.active),
          type: sanitize(request.components.building.type)
        };
      }
    }
    return filteredRequest;
  }

  static filterTenantResponse(tenant: Tenant, loggedUser: UserToken): Partial<Tenant> {
    let filteredTenant: Partial<Tenant>;
    if (!tenant) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadTenant(loggedUser)) {
      // Set only necessary info
      filteredTenant = {};
      filteredTenant.id = tenant.id;
      filteredTenant.name = tenant.name;
      filteredTenant.email = tenant.email;
      filteredTenant.subdomain = tenant.subdomain;
      filteredTenant.components = tenant.components;

      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredTenant, tenant, loggedUser);
    }
    return filteredTenant;
  }

  static filterTenantsResponse(tenants: DataResult<Tenant>, loggedUser: UserToken) {
    const filteredTenants = [];
    if (!tenants.result) {
      return null;
    }
    if (!Authorizations.canListTenants(loggedUser)) {
      return null;
    }
    for (const tenant of tenants.result) {
      // Filter
      const filteredTenant = TenantSecurity.filterTenantResponse(tenant, loggedUser);
      // Add
      if (filteredTenant) {
        filteredTenants.push(filteredTenant);
      }
    }
    tenants.result = filteredTenants;
  }
}

