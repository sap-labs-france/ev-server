import { HttpCompaniesRequest, HttpCompanyLogoRequest } from '../../../../../types/requests/HttpCompanyRequest';

import Company from '../../../../../types/Company';
import HttpByIDRequest from '../../../../../types/requests/HttpByIDRequest';
import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class CompanySecurity {

  public static filterCompanyRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterCompanyLogoRequest(request: any): HttpCompanyLogoRequest {
    return {
      ID: sanitize(request.ID),
      TenantID: sanitize(request.TenantID),
    };
  }

  public static filterCompanyRequest(request: any): HttpByIDRequest {
    return {
      ID: sanitize(request.ID)
    };
  }

  public static filterCompaniesRequest(request: any): HttpCompaniesRequest {
    const filteredRequest: HttpCompaniesRequest = {
      Search: sanitize(request.Search),
      WithSites: UtilsSecurity.filterBoolean(request.WithSites),
      WithLogo: UtilsSecurity.filterBoolean(request.WithLogo)
    } as HttpCompaniesRequest;
    if (request.Issuer) {
      filteredRequest.Issuer = UtilsSecurity.filterBoolean(request.Issuer);
    }
    if (Utils.containsGPSCoordinates([request.LocLongitude, request.LocLatitude])) {
      filteredRequest.LocCoordinates = [
        Utils.convertToFloat(sanitize(request.LocLongitude)),
        Utils.convertToFloat(sanitize(request.LocLatitude))
      ];
      if (request.LocMaxDistanceMeters) {
        request.LocMaxDistanceMeters = Utils.convertToInt(sanitize(request.LocMaxDistanceMeters));
        if (request.LocMaxDistanceMeters > 0) {
          filteredRequest.LocMaxDistanceMeters = request.LocMaxDistanceMeters;
        }
      }
    }
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterCompanyUpdateRequest(request: any): Partial<Company> {
    const filteredRequest = CompanySecurity._filterCompanyRequest(request);
    return {
      id: sanitize(request.id),
      ...filteredRequest
    };
  }

  public static filterCompanyCreateRequest(request: any): Partial<Company> {
    return CompanySecurity._filterCompanyRequest(request);
  }

  public static _filterCompanyRequest(request: any): Partial<Company> {
    const filteredRequest = {
      name: sanitize(request.name),
      address: UtilsSecurity.filterAddressRequest(request.address)
    } as Partial<Company>;
    if (Utils.objectHasProperty(request, 'logo')) {
      filteredRequest.logo = sanitize(request.logo);
    }
    return filteredRequest;
  }
}
