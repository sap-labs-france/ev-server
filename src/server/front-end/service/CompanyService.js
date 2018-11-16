const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Constants = require('../../../utils/Constants');
const Company = require('../../../entity/Company');
const User = require('../../../entity/User');
const Authorizations = require('../../../authorization/Authorizations');
const CompanySecurity = require('./security/CompanySecurity');

class CompanyService {
  static async handleDeleteCompany(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = CompanySecurity.filterCompanyDeleteRequest(
        req.query, req.user);
      // Check Mandatory fields
      if(!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company's ID must be provided`, 500,
          'CompanyService', 'handleDeleteCompany', req.user);
      }
      // Get
      const company = await Company.getCompany(req.user.tenantID, filteredRequest.ID);
      // Found?
      if (!company) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Company with ID '${filteredRequest.ID}' does not exist`, 550,
          'CompanyService', 'handleDeleteCompany', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteCompany(req.user, company.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_COMPANY,
          company.getID(),
          560, 'CompanyService', 'handleDeleteCompany',
          req.user);
      }
      // Delete
      await company.delete();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'CompanyService', method: 'handleDeleteCompany',
        message: `Company '${company.getName()}' has been deleted successfully`,
        action: action, detailedMessages: company});
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetCompany(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = CompanySecurity.filterCompanyRequest(req.query, req.user);
      // Charge Box is mandatory
      if(!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company's ID must be provided`, 500,
          'CompanyService', 'handleGetCompany', req.user);
      }
      // Get it
      const company = await Company.getCompany(req.user.tenantID, filteredRequest.ID);
      if (!company) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company with ID '${filteredRequest.ID}' does not exist anymore`, 550,
          'CompanyService', 'handleGetCompany', req.user);
      }
      // Check auth
      if (!Authorizations.canReadCompany(req.user, company.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_COMPANY,
          company.getID(),
          560, 'CompanyService', 'handleGetCompany',
          req.user);
      }
      // Return
      res.json(
        // Filter
        CompanySecurity.filterCompanyResponse(
          company.getModel(), req.user)
      );
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetCompanyLogo(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = CompanySecurity.filterCompanyRequest(req.query, req.user);
      // Charge Box is mandatory
      if(!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company's ID must be provided`, 500,
          'CompanyService', 'handleGetCompanyLogo', req.user);
      }
      // Get it
      const company = await Company.getCompany(req.user.tenantID, filteredRequest.ID);
      if (!company) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company with ID '${filteredRequest.ID}' does not exist anymore`, 550,
          'CompanyService', 'handleGetCompanyLogo', req.user);
      }
      // Check auth
      if (!Authorizations.canReadCompany(req.user, company.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_COMPANY,
          company.getID(),
          560, 'CompanyService', 'handleGetCompanyLogo',
          req.user);
      }
      // Get the logo
      const companyLogo = await Company.getCompanyLogo(req.user.tenantID, filteredRequest.ID);
      // Return
      res.json(companyLogo);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetCompanyLogos(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListCompanies(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_COMPANIES,
          null,
          560, 'CompanyService', 'handleGetCompanyLogos',
          req.user);
      }
      // Get the company logo
      const companyLogos = await Company.getCompanyLogos(req.user.tenantID);
      res.json(companyLogos);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetCompanies(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListCompanies(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_COMPANIES,
          null,
          560, 'CompanyService', 'handleGetCompanies',
          req.user);
      }
      // Filter
      const filteredRequest = CompanySecurity.filterCompaniesRequest(req.query, req.user);
      // Get the companies
      const companies = await Company.getCompanies(req.user.tenantID,
        { search: filteredRequest.Search, withSites: filteredRequest.WithSites },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      companies.result = companies.result.map((company) => company.getModel());
      // Filter
      companies.result = CompanySecurity.filterCompaniesResponse(
        companies.result, req.user);
      // Return
      res.json(companies);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleCreateCompany(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canCreateCompany(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_COMPANY,
          null,
          560, 'CompanyService', 'handleCreateCompany',
          req.user);
      }
      // Filter
      const filteredRequest = CompanySecurity.filterCompanyCreateRequest( req.body, req.user );
      // Check Mandatory fields
      Company.checkIfCompanyValid(filteredRequest, req);
      // Create
      const company = new Company(req.user.tenantID, filteredRequest);
      // Update timestamp
      company.setCreatedBy(new User(req.user.tenantID, {'id': req.user.id}));
      company.setCreatedOn(new Date());
      // Save
      const newCompany = await company.save();
      // Update Company's Logo
      newCompany.setLogo(company.getLogo());
      // Save
      await newCompany.saveLogo();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'CompanyService', method: 'handleCreateCompany',
        message: `Company '${newCompany.getName()}' has been created successfully`,
        action: action, detailedMessages: newCompany});
      // Ok
      res.json(Object.assign({ id: newCompany.getID() }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleUpdateCompany(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = CompanySecurity.filterCompanyUpdateRequest( req.body, req.user );
      // Check email
      const company = await Company.getCompany(req.user.tenantID, filteredRequest.id);
      if (!company) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company with ID '${filteredRequest.id}' does not exist anymore`, 550,
          'CompanyService', 'handleUpdateCompany', req.user);
      }
      // Check Mandatory fields
      Company.checkIfCompanyValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateCompany(req.user, company.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_COMPANY,
          company.getID(),
          560, 'CompanyService', 'handleCreateCompany',
          req.user);
      }
      // Update
      Database.updateCompany(filteredRequest, company.getModel());
      // Update timestamp
      company.setLastChangedBy(new User(req.user.tenantID, {'id': req.user.id}));
      company.setLastChangedOn(new Date());
      // Update Company
      const updatedCompany = await company.save();
      // Update Company's Logo
      await company.saveLogo();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'CompanyService', method: 'handleUpdateCompany',
        message: `Company '${updatedCompany.getName()}' has been updated successfully`,
        action: action, detailedMessages: updatedCompany});
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}

module.exports = CompanyService;
