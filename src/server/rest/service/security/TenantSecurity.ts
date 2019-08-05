import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';
import { HttpTenantDeleteRequest, HttpTenantVerifyRequest, HttpTenantsRequest } from '../../../../types/requests/HttpTenantRequest';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import Tenant from '../../../../types/Tenant';
import UserToken from '../../../../types/UserToken';

export default class TenantSecurity {
  public static filterTenantDeleteRequest(request: HttpTenantDeleteRequest): HttpTenantDeleteRequest {
    return {
      ID: sanitize(request.ID),
      forced: sanitize(request.forced)
    };
  }

  public static filterTenantRequestByID(request: HttpByIDRequest): HttpByIDRequest {
    return sanitize(request.ID);
  }

  public static filterVerifyTenantRequest(request: HttpTenantVerifyRequest): HttpTenantVerifyRequest {
    return { tenant: sanitize(request.tenant) };
  }

  public static filterTenantsRequest(request: HttpTenantsRequest): HttpTenantsRequest {
    const filteredRequest: HttpTenantsRequest = {} as HttpTenantsRequest;
    filteredRequest.Search = sanitize(request.Search);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterTenantRequest(request: Partial<Tenant>): Partial<Tenant> {
    const filteredRequest: Partial<Tenant> = {};
    if ('id' in request) {
      filteredRequest.id = sanitize(request.id);
    }
    filteredRequest.name = sanitize(request.name);
    filteredRequest.subdomain = sanitize(request.subdomain);
    filteredRequest.email = sanitize(request.email);
    filteredRequest.components = sanitize(request.components);
    return filteredRequest;
  }

  static filterTenantResponse(tenant: Tenant, loggedUser: UserToken): Partial<Tenant> {
    const filteredTenant: Partial<Tenant>;
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

  static filterTenantsResponse(tenants, loggedUser: UserToken): Tenant[] {
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
      // Ok?
      if (filteredTenant) {
        // Add
        filteredTenants.push(filteredTenant);
      }
    }
    tenants.result = filteredTenants;
  }
}

