const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');

let SiteSecurity; // Avoid circular deps

class CompanySecurity {
  static getSiteSecurity() {
    if (!SiteSecurity) {
      SiteSecurity = require('./SiteSecurity');
    }
    return SiteSecurity;
  }

  // eslint-disable-next-line no-unused-vars
  static filterCompanyDeleteRequest(request, loggedUser) {
    const filteredRequest = {};
    // Set
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterCompanyRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.ID = sanitize(request.ID);
    return filteredRequest;
  }

  // eslint-disable-next-line no-unused-vars
  static filterCompaniesRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.Search = sanitize(request.Search);
    filteredRequest.WithSites = UtilsSecurity.filterBoolean(request.WithSites);
    filteredRequest.WithLogo = UtilsSecurity.filterBoolean(request.WithLogo);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  static filterCompanyUpdateRequest(request, loggedUser) {
    // Set
    const filteredRequest = CompanySecurity._filterCompanyRequest(request, loggedUser);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  static filterCompanyCreateRequest(request, loggedUser) {
    return CompanySecurity._filterCompanyRequest(request, loggedUser);
  }

  static _filterCompanyRequest(request, loggedUser) {
    const filteredRequest = {};
    filteredRequest.name = sanitize(request.name);
    filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address, loggedUser);
    filteredRequest.logo = sanitize(request.logo);
    return filteredRequest;
  }

  static filterCompanyResponse(company, loggedUser) {
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
      }
      if (company.address) {
        filteredCompany.address = UtilsSecurity.filterAddressRequest(company.address, loggedUser);
      }
      if (company.sites) {
        filteredCompany.sites = company.sites.map((site) => {
          return CompanySecurity.getSiteSecurity().filterSiteResponse(site, loggedUser);
        });
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredCompany, company, loggedUser);
    }
    return filteredCompany;
  }

  static filterCompaniesResponse(companies, loggedUser) {
    const filteredCompanies = [];

    if (!companies) {
      return null;
    }
    if (!Authorizations.canListCompanies(loggedUser)) {
      return null;
    }
    for (const company of companies) {
      // Filter
      const filteredCompany = CompanySecurity.filterCompanyResponse(company, loggedUser);
      // Ok?
      if (filteredCompany) {
        // Add
        filteredCompanies.push(filteredCompany);
      }
    }
    return filteredCompanies;
  }
}

module.exports = CompanySecurity;
