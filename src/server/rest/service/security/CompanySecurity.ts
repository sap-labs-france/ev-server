import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';
import SiteSecurity from './SiteSecurity';
import User from '../../../../entity/User';
import Company from '../../../../types/Company';

export default class CompanySecurity {

  //
  public static filterCompanyRequest(request: {ID: string}): string {
    return sanitize(request.ID);
  }

  public static filterCompaniesRequest(request): {Search: string, WithSites: boolean, Skip?: number, Limit?: number, OnlyRecordCount?: boolean, Sort?: any} {
    let filteredRequest: {Search: string, WithSites: boolean, Skip?: number, Limit?: number, OnlyRecordCount?: boolean, Sort?: any} = {
      Search: sanitize(request.Search), 
      WithSites: UtilsSecurity.filterBoolean(request.WithSites)
    };
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }//TODO better also check CompanyStorage sort params

  static filterCompanyUpdateRequest(request: any): {name: string, address: any, logo: string, id: string} {
    const filteredRequest = CompanySecurity._filterCompanyRequest(request);
    return {id: sanitize(request.id), ...filteredRequest};
  }

  public static filterCompanyCreateRequest(request: any) {
    return CompanySecurity._filterCompanyRequest(request);
  }

  public static _filterCompanyRequest(request: any) {
    return {name: request.name, address: UtilsSecurity.filterAddressRequest(request.address), logo: request.logo};
  }

  public static filterCompanyResponse(company: Company, loggedUser: User) { //TODO typings
    let filteredCompany;

    if (!company) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadCompany(loggedUser, company)) {
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
      // Ok?
      if (filteredCompany) {
        // Add
        filteredCompanies.push(filteredCompany);
      }
    }
    companies.result = filteredCompanies;
  }
}


