import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import UtilsSecurity from './UtilsSecurity';
import SiteSecurity from './SiteSecurity';
import User from '../../../../entity/User';
import Company from '../../../../types/Company';
import ByID from '../../../../types/requests/ByID';
import CompanyData from '../../../../types/requests/CompanyData';
import { IncomingCompanySearch, FilteredCompanySearch } from '../../../../types/requests/CompanySearch';
import BadRequestError from '../../../../exception/BadRequestError';

export default class CompanySecurity {

  public static filterCompanyRequest(request: ByID): string {
    return sanitize(request.ID);
  }

  public static filterCompaniesRequest(request: IncomingCompanySearch): FilteredCompanySearch {
    let filteredRequest: FilteredCompanySearch = {
      Search: sanitize(request.Search), 
      WithSites: UtilsSecurity.filterBoolean(request.WithSites)
    } as FilteredCompanySearch;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterCompanyUpdateRequest(request: CompanyData): CompanyData {
    if(! request.id) {
      throw new BadRequestError({message: 'ID not provided in update request.'});
    }
    const filteredRequest = CompanySecurity._filterCompanyRequest(request);
    return {id: sanitize(request.id), ...filteredRequest};
  }

  public static filterCompanyCreateRequest(request: CompanyData): CompanyData {
    return CompanySecurity._filterCompanyRequest(request);
  }

  public static _filterCompanyRequest(request: CompanyData): CompanyData {
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


