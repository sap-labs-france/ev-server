import { NextFunction, Request, Response } from 'express';
import AppAuthError from '../../../exception/AppAuthError';
import Authorizations from '../../../authorization/Authorizations';
import Company from '../../../types/Company';
import CompanySecurity from './security/CompanySecurity';
import CompanyStorage from '../../../storage/mongodb/CompanyStorage';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import Utils from '../../../utils/Utils';
import UtilsService from './UtilsService';

export default class CompanyService {

  public static async handleDeleteCompany(action: string, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_DELETE, Constants.ENTITY_COMPANY, 'CompanyService', 'handleDeleteCompany');
    // Filter
    const companyID = CompanySecurity.filterCompanyRequestByID(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(companyID, 'CompanyService', 'handleDeleteCompany', req.user);
    // Check auth
    if (!Authorizations.canDeleteCompany(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_COMPANY,
        companyID,
        Constants.HTTP_AUTH_ERROR, 'CompanyService', 'handleDeleteCompany',
        req.user);
    }
    // Get
    const company = await CompanyStorage.getCompany(req.user.tenantID, companyID);
    // Found?
    UtilsService.assertObjectExists(company, `Company with ID '${companyID}' does not exist`, 'CompanyService', 'handleDeleteCompany', req.user);
    // Delete
    await CompanyStorage.deleteCompany(req.user.tenantID, company.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'CompanyService', method: 'handleDeleteCompany',
      message: `Company '${company.name}' has been deleted successfully`,
      action: action, detailedMessages: company
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetCompany(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_READ, Constants.ENTITY_COMPANY, 'CompanyService', 'handleGetCompany');
    // Filter
    const filteredRequest = CompanySecurity.filterCompanyRequest(req.query);
    // ID is mandatory
    UtilsService.assertIdIsProvided(filteredRequest.ID, 'CompanyService', 'handleGetCompany', req.user);
    // Check auth
    if (!Authorizations.canReadCompany(req.user, filteredRequest.ID)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_COMPANY,
        filteredRequest.ID,
        Constants.HTTP_AUTH_ERROR, 'CompanyService', 'handleGetCompany',
        req.user);
    }
    // Get it
    const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.ID);
    UtilsService.assertObjectExists(company, `Company with ID '${filteredRequest.ID}' does not exist`, 'CompanyService', 'handleGetCompany', req.user);
    // Return
    res.json(
      // Filter
      CompanySecurity.filterCompanyResponse(company, req.user)
    );
    next();
  }

  public static async handleGetCompanyLogo(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_READ, Constants.ENTITY_COMPANY, 'CompanyService', 'handleGetCompanyLogo');
    // Filter
    const companyID = CompanySecurity.filterCompanyRequestByID(req.query);
    // Charge Box is mandatory
    UtilsService.assertIdIsProvided(companyID, 'CompanyService', 'handleGetCompanyLogo', req.user);
    // Check auth
    if (!Authorizations.canReadCompany(req.user, companyID)) {
      throw new AppAuthError(
        Constants.ACTION_READ, Constants.ENTITY_COMPANY,
        companyID,
        Constants.HTTP_AUTH_ERROR, 'CompanyService', 'handleGetCompanyLogo',
        req.user);
    }
    // Get it
    const companyLogo = await CompanyStorage.getCompanyLogo(req.user.tenantID, companyID);
    // Check
    UtilsService.assertObjectExists(companyLogo, `Company with ID '${companyID}' does not exist`, 'CompanyService', 'handleGetCompanyLogo', req.user);
    // Return
    res.json({ id: companyLogo.id, logo: companyLogo.logo });
    next();
  }

  public static async handleGetCompanies(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_LIST, Constants.ENTITY_COMPANIES, 'CompanyService', 'handleGetCompanies');
    // Check auth
    if (!Authorizations.canListCompanies(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_COMPANIES,
        null,
        Constants.HTTP_AUTH_ERROR, 'CompanyService', 'handleGetCompanies',
        req.user);
    }
    // Filter
    const filteredRequest = CompanySecurity.filterCompaniesRequest(req.query);
    // Get the companies
    const companies = await CompanyStorage.getCompanies(req.user.tenantID,
      {
        search: filteredRequest.Search,
        companyIDs: Authorizations.getAuthorizedCompanyIDs(req.user),
        withSites: filteredRequest.WithSites,
        withLogo: filteredRequest.WithLogo
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      [ 'id', 'name', 'address.latitude', 'address.longitude', 'address.city', 'address.country', 'logo']
    );
    // Filter
    CompanySecurity.filterCompaniesResponse(companies, req.user);
    // Return
    res.json(companies);
    next();
  }

  public static async handleCreateCompany(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_CREATE, Constants.ENTITY_COMPANY, 'CompanyService', 'handleCreateCompany');
    // Check auth
    if (!Authorizations.canCreateCompany(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_CREATE,
        Constants.ENTITY_COMPANY,
        null,
        Constants.HTTP_AUTH_ERROR, 'CompanyService', 'handleCreateCompany',
        req.user);
    }
    // Filter
    const filteredRequest = CompanySecurity.filterCompanyCreateRequest(req.body);
    // Check
    Utils.checkIfCompanyValid(filteredRequest, req);
    // Create company
    const newCompany: Company = {
      ...filteredRequest,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Company;
    // Save
    newCompany.id = await CompanyStorage.saveCompany(req.user.tenantID, newCompany);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'CompanyService', method: 'handleCreateCompany',
      message: `Company '${newCompany.id}' has been created successfully`,
      action: action, detailedMessages: newCompany
    });
    // Ok
    res.json(Object.assign({ id: newCompany.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateCompany(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_UPDATE, Constants.ENTITY_COMPANY, 'CompanyService', 'handleUpdateCompany');
    // Filter
    const filteredRequest = CompanySecurity.filterCompanyUpdateRequest(req.body);
    // Check auth
    if (!Authorizations.canUpdateCompany(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_COMPANY,
        filteredRequest.id,
        Constants.HTTP_AUTH_ERROR, 'CompanyService', 'handleUpdateCompany',
        req.user);
    }
    // Check email
    const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.id);
    // Check
    UtilsService.assertObjectExists(company, `Site Area with ID '${filteredRequest.id}' does not exist`, 'CompanyService', 'handleUpdateCompany', req.user);
    // Check Mandatory fields
    Utils.checkIfCompanyValid(filteredRequest, req);
    // Update
    company.name = filteredRequest.name;
    company.address = filteredRequest.address;
    company.logo = filteredRequest.logo;
    company.lastChangedBy = { 'id': req.user.id };
    company.lastChangedOn = new Date();
    // Update Company
    await CompanyStorage.saveCompany(req.user.tenantID, company);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'CompanyService', method: 'handleUpdateCompany',
      message: `Company '${company.name}' has been updated successfully`,
      action: action, detailedMessages: company
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
