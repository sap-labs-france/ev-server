import Logging from '../../../utils/Logging';
import AppError from '../../../exception/AppError';
import AppAuthError from '../../../exception/AppAuthError';
import Constants from '../../../utils/Constants';
import Company from '../../../types/Company';
import User from '../../../entity/User';
import Authorizations from '../../../authorization/Authorizations';
import CompanySecurity from './security/CompanySecurity';
import UtilsService from './UtilsService';
import { NextFunction, Request, Response } from 'express';
import CompanyStorage from '../../../storage/mongodb/CompanyStorage';

export default class CompanyService {

  public static async handleDeleteCompany(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_DELETE, Constants.ENTITY_COMPANY, 'CompanyService', 'handleDeleteCompany');

      // Filter
      const companyID = CompanySecurity.filterCompanyRequestByID(req.query);

      // Check Mandatory fields
      UtilsService.assertIdIsProvided(companyID, 'CompanyService', 'handleDeleteCompany', req.user);

      // Check auth
      if (!Authorizations.canDeleteCompany(req.user)) {
        // Not Authorized!
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
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleGetCompany(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_READ, Constants.ENTITY_COMPANY, 'CompanyService', 'handleGetCompany');

      // Filter
      const filteredRequest = CompanySecurity.filterCompanyRequest(req.query);

      // ID is mandatory
      UtilsService.assertIdIsProvided(filteredRequest.ID, 'CompanyService', 'handleGetCompany', req.user);

      // Check auth
      if (!Authorizations.canReadCompany(req.user, filteredRequest.ID)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_COMPANY,
          filteredRequest.ID,
          Constants.HTTP_AUTH_ERROR, 'CompanyService', 'handleGetCompany',
          req.user);
      }

      // Get it
      const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.ID);

      // Found?
      UtilsService.assertObjectExists(company, `The Company with ID '${filteredRequest.ID}' does not exist`, 'CompanyService', 'handleGetCompany', req.user);

      // Return
      res.json(
        // Filter
        CompanySecurity.filterCompanyResponse(company, req.user)
      );
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleGetCompanyLogo(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_READ, Constants.ENTITY_COMPANY, 'CompanyService', 'handleGetCompanyLogo');

      // Filter
      const companyID = CompanySecurity.filterCompanyRequestByID(req.query);

      // Charge Box is mandatory
      UtilsService.assertIdIsProvided(companyID, 'CompanyService', 'handleGetCompanyLogo', req.user);

      // Check auth
      if (!Authorizations.canReadCompany(req.user, companyID)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ, Constants.ENTITY_COMPANY,
          companyID,
          Constants.HTTP_AUTH_ERROR, 'CompanyService', 'handleGetCompanyLogo',
          req.user);
      }

      // Get it
      const company = await CompanyStorage.getCompany(req.user.tenantID, companyID);

      // Check
      UtilsService.assertObjectExists(company, `The Company with ID '${companyID}' does not exist`, 'CompanyService', 'handleGetCompanyLogo', req.user);

      // Return
      res.json({ id: company.id, logo: company.logo });
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleGetCompanies(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_LIST, Constants.ENTITY_COMPANIES, 'CompanyService', 'handleGetCompanies');

      // Check auth
      if (!Authorizations.canListCompanies(req.user)) {
        // Not Authorized!
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
          companyIDs: Authorizations.getAuthorizedEntityIDsFromLoggedUser(Constants.ENTITY_COMPANY, req.user),
          withSites: filteredRequest.WithSites,
          onlyRecordCount: filteredRequest.OnlyRecordCount
        },
        { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort }
      );

      // Filter
      CompanySecurity.filterCompaniesResponse(companies, req.user);

      // Return
      res.json(companies);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleCreateCompany(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_CREATE, Constants.ENTITY_COMPANY, 'CompanyService', 'handleCreateCompany');

      // Check auth
      if (!Authorizations.canCreateCompany(req.user)) {
        // Not Authorized!
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
      CompanyService._checkIfCompanyValid(filteredRequest, req);

      // Create company
      const newCompany: Company = {
        ...filteredRequest,
        createdBy: new User(req.user.tenantID, { id: req.user.id }),
        createdOn: new Date(),
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
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleUpdateCompany(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if component is active
      await UtilsService.assertComponentIsActive(
        req.user.tenantID, Constants.COMPONENTS.ORGANIZATION,
        Constants.ACTION_UPDATE, Constants.ENTITY_COMPANY, 'CompanyService', 'handleUpdateCompany');

      // Filter
      const filteredRequest = CompanySecurity.filterCompanyUpdateRequest(req.body);

      // Check auth
      if (!Authorizations.canUpdateCompany(req.user)) {
        // Not Authorized!
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
      UtilsService.assertObjectExists(company, `The Site Area with ID '${filteredRequest.id}' does not exist`, 'CompanyService', 'handleUpdateCompany', req.user);

      // Check Mandatory fields
      CompanyService._checkIfCompanyValid(filteredRequest, req);

      // Update
      company.name = filteredRequest.name;
      company.address = filteredRequest.address;
      company.logo = filteredRequest.logo;
      company.lastChangedBy = new User(req.user.tenantID, { 'id': req.user.id });
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
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  private static _checkIfCompanyValid(filteredRequest: any, req: Request): void {
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company ID is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'CompanyService', 'checkIfCompanyValid',
        req.user.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company Name is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'CompanyService', 'checkIfCompanyValid',
        req.user.id, filteredRequest.id);
    }
  }
}

