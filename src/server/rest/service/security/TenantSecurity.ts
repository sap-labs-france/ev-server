import { HttpTenantVerifyRequest, HttpTenantsRequest } from '../../../../types/requests/HttpTenantRequest';

import Authorizations from '../../../../authorization/Authorizations';
import { DataResult } from '../../../../types/DataResult';
import Tenant from '../../../../types/Tenant';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

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

  static filterTenantResponse(tenant: Tenant, loggedUser: UserToken): Tenant {
    let filteredTenant: Tenant;
    if (!tenant) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadTenant(loggedUser)) {
      // Set only necessary info
      filteredTenant = {} as Tenant;
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

  static filterTenantsResponse(tenants: DataResult<Tenant>, loggedUser: UserToken): void {
    const filteredTenants: Tenant[] = [];
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

