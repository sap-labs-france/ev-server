import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import Company from '../../../../types/Company';
import HttpByIDRequest from '../../../../types/requests/HttpByIDRequest';
import { HttpCompaniesRequest, HttpCompanyRequest } from '../../../../types/requests/HttpCompanyRequest';
import SiteSecurity from './SiteSecurity';
import UtilsSecurity from './UtilsSecurity';
import UserToken from '../../../../types/UserToken';

export default class CompanySecurity {

  public static filterCompanyRequestByID(request: HttpByIDRequest): string {
    return sanitize(request.ID);
  }

  public static filterCompanyRequest(request: HttpByIDRequest): HttpCompanyRequest {
    return {
      ID: sanitize(request.ID)
    };
  }

  public static filterCompaniesRequest(request: Partial<HttpCompaniesRequest>): HttpCompaniesRequest {
    const filteredRequest: HttpCompaniesRequest = {
      Search: sanitize(request.Search),
      WithSites: UtilsSecurity.filterBoolean(request.WithSites),
      WithLogo: UtilsSecurity.filterBoolean(request.WithLogo)
    } as HttpCompaniesRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterCompanyUpdateRequest(request: Partial<Company>): Partial<Company> {
    const filteredRequest = CompanySecurity._filterCompanyRequest(request);
    return {
      id: sanitize(request.id),
      ...filteredRequest
    };
  }

  public static filterCompanyCreateRequest(request: Partial<Company>): Partial<Company> {
    return CompanySecurity._filterCompanyRequest(request);
  }

  public static _filterCompanyRequest(request: Partial<Company>): Partial<Company> {
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
      if (Authorizations.isAdmin(loggedUser.role)) {
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
        filteredCompany.sites = company.sites.map((site) => {
          return SiteSecurity.filterSiteResponse(site, loggedUser);
        });
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredCompany, company, loggedUser);
    }
    return filteredCompany;
  }

  public static filterCompaniesResponse(companies, loggedUser) {
    const filteredCompanies = [];

    if (!companies.result) {
      return null;
    }
    if (!Authorizations.canListCompanies(loggedUser)) {
      return null;
    }
    for (const company of companies.result) {
      // Filter
      const filteredCompany = CompanySecurity.filterCompanyResponse(company, loggedUser);
      // Add
      if (filteredCompany) {
        filteredCompanies.push(filteredCompany);
      }
    }
    companies.result = filteredCompanies;
  }
}
