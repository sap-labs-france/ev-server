import { HttpTenantVerifyRequest, HttpTenantsRequest } from '../../../../../types/requests/HttpTenantRequest';

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
    filteredRequest.WithLogo = UtilsSecurity.filterBoolean(request.WithLogo);
    filteredRequest.WithComponents = UtilsSecurity.filterBoolean(request.WithComponents);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }
}

