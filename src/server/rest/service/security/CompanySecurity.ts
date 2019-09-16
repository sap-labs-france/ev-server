import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Company from '../../../../types/Company';
import { HttpCompaniesRequest, HttpCompanyRequest } from '../../../../types/requests/HttpCompanyRequest';
import SiteSecurity from './SiteSecurity';
import UserToken from '../../../../types/UserToken';
import UtilsSecurity from './UtilsSecurity';
import { DataResult } from '../../../../types/DataResult';

export default class CompanySecurity {

  public static filterCompanyRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterCompanyRequest(request: any): HttpCompanyRequest {
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
    return {
      name: sanitize(request.name),
      address: UtilsSecurity.filterAddressRequest(request.address),
      logo: request.logo
    };
  }

  public static filterCompanyResponse(company: Company, loggedUser: UserToken) { // TODO: typings
    let filteredCompany;

    if (!company) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadCompany(loggedUser, company.id)) {
      // Admin?
      if (Authorizations.isAdmin(loggedUser)) {
        // Yes: set all params
        filteredCompany = company;
      } else {
        // Set only necessary info
        filteredCompany = {};
        filteredCompany.id = company.id;
        filteredCompany.name = company.name;
        filteredCompany.logo = company.logo;
        filteredCompany.address = UtilsSecurity.filterAddressRequest(company.address);
      }
      if (company.sites) {
        filteredCompany.sites = company.sites.map((site) => SiteSecurity.filterSiteResponse(site, loggedUser));
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredCompany, company, loggedUser);
    }
    return filteredCompany;
  }

  public static filterCompaniesResponse(companies: DataResult<Company>, loggedUser) {
    const filteredCompanies = [];

    if (!companies.result) {
      return null;
    }
    if (!Authorizations.canListCompanies(loggedUser)) {
      return null;
    }
    for (const company of companies.result) {
      // Add
      const filteredCompany = CompanySecurity.filterCompanyResponse(company, loggedUser);
      if (filteredCompany) {
        filteredCompanies.push(filteredCompany);
      }
    }
    companies.result = filteredCompanies;
  }
}
