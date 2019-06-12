import Logging from '../../../utils/Logging';
import Database from '../../../utils/Database';
import AppError from '../../../exception/AppError';
import AppAuthError from '../../../exception/AppAuthError';
import Constants from '../../../utils/Constants';
import Company from '../../../types/Company';
import User from '../../../entity/User';
import Authorizations from '../../../authorization/Authorizations';
import CompanySecurity from './security/CompanySecurity';
import UtilsService from './UtilsService';
import OrganizationComponentInactiveError from '../../../exception/OrganizationComponentInactiveError';
import { Request, NextFunction, Response } from 'express';
import CompanyStorage from '../../../storage/mongodb/CompanyStorage';
import { ObjectID } from 'bson';
import fs from 'fs';

export default class CompanyService {

  public static async handleDeleteCompany(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_COMPANY,
          560, 'CompanyService', 'handleDeleteCompany');
      }

      // Filter
      const companyId = CompanySecurity.filterCompanyRequest(req.query);

      // Check Mandatory fields
      if (!companyId) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company's ID must be provided`, 500,
          'CompanyService', 'handleDeleteCompany', req.user);
      }

      // Get
      const company = await CompanyStorage.getCompany(req.user.tenantID, companyId);

      // Found?
      if (!company) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Company with ID '${companyId}' does not exist`, 550,
          'CompanyService', 'handleDeleteCompany', req.user);
      }

      // Check auth
      if (!Authorizations.canDeleteCompany(req.user, company)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_COMPANY,
          company.id,
          560, 'CompanyService', 'handleDeleteCompany',
          req.user);
      }

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
      // check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_READ,
          Constants.ENTITY_COMPANY,
          560, 'CompanyService', 'handleGetCompany');
      }

      // Filter
      const companyId = CompanySecurity.filterCompanyRequest(req.query);
      // Charge Box is mandatory
      
      if (!companyId) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company's ID must be provided`, 500,
          'CompanyService', 'handleGetCompany', req.user);
      }

      // Get it
      const company = await CompanyStorage.getCompany(req.user.tenantID, companyId);
      
      if (!company) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company with ID '${companyId}' does not exist anymore`, 550,
          'CompanyService', 'handleGetCompany', req.user);
      }
      // Check auth
      if (!Authorizations.canReadCompany(req.user, company)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_COMPANY,
          company.id,
          560, 'CompanyService', 'handleGetCompany',
          req.user);
      }
      // Return
      res.json(
        // Filter
        CompanySecurity.filterCompanyResponse(
          company, req.user)
      );
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  public static async handleGetCompanyLogo(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_READ,
          Constants.ENTITY_COMPANY,
          560, 'CompanyService', 'handleGetCompanyLogo');
      }

      // Filter
      const companyId = CompanySecurity.filterCompanyRequest(req.query);
      
      // Charge Box is mandatory
      if (!companyId) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company's ID must be provided`, 500,
          'CompanyService', 'handleGetCompanyLogo', req.user);
      }
      
      // Get it
      const company = await CompanyStorage.getCompany(req.user.tenantID, companyId);
      if (!company) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company with ID '${companyId}' does not exist anymore`, 550,
          'CompanyService', 'handleGetCompanyLogo', req.user);
      }

      // Check auth
      if (!Authorizations.canReadCompany(req.user, company)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_COMPANY,
          company.id,
          560, 'CompanyService', 'handleGetCompanyLogo',
          req.user);
      }
      // Return
      res.json({id: company.id, logo:company.logo});
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  /**
   * @deprecated 
   */
  public static async handleGetCompanyLogos(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    res.json({error: 'Action CompanyLogos is deprecated.'});
    // try {
    //   // check if organization component is active
    //   if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
    //     throw new OrganizationComponentInactiveError(
    //       Constants.ACTION_LIST,
    //       Constants.ENTITY_COMPANIES,
    //       560, 'CompanyService', 'handleGetCompanyLogos');
    //   }

    //   // Check auth
    //   if (!Authorizations.canListCompanies(req.user)) {
    //     // Not Authorized!
    //     throw new AppAuthError(
    //       Constants.ACTION_LIST,
    //       Constants.ENTITY_COMPANIES,
    //       null,
    //       560, 'CompanyService', 'handleGetCompanyLogos',
    //       req.user);
    //   }
    //   // Get the company logo
    //   const companyLogos = await Company.getCompanyLogos(req.user.tenantID);
    //   res.json(companyLogos);
    //   next();
    // } catch (error) {
    //   // Log
    //   Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    // }
  }

  public static async handleGetCompanies(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_LIST,
          Constants.ENTITY_COMPANIES,
          560, 'CompanyService', 'handleGetCompanies');
      }

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
      const filteredRequest = CompanySecurity.filterCompaniesRequest(req.query);
      
      // Get the companies
      const companies = (await CompanyStorage.getCompanies(req.user.tenantID,
        {
          search: filteredRequest.Search,
          companyIDs: Authorizations.getAuthorizedEntityIDsFromLoggedUser(Constants.ENTITY_COMPANY, req.user),
          withSites: filteredRequest.WithSites,
          onlyRecordCount: filteredRequest.OnlyRecordCount
        },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort));
     
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
      // check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_COMPANY,
          560, 'CompanyService', 'handleCreateCompany');
      }

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
      const idlessCompany = CompanySecurity.filterCompanyCreateRequest(req.body);
      const company: Company = {
        id: new ObjectID().toHexString(),
        createdBy: new User(req.user.tenantID, {id: req.user.id}),
        createdOn: new Date(),
        ...idlessCompany};

      // Check Mandatory fields
      CompanyService._checkIfCompanyValid(company, req);
      
      // Save
      await CompanyStorage.saveCompany(req.user.tenantID, company, true);
      
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'CompanyService', method: 'handleCreateCompany',
        message: `Company '${company.id}' has been created successfully`,
        action: action, detailedMessages: company
      });
      // Ok
      res.json(Object.assign({ id: company.id }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleUpdateCompany(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // check if organization component is active
      if (!await UtilsService.isOrganizationComponentActive(req.user.tenantID)) {
        throw new OrganizationComponentInactiveError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_COMPANY,
          560, 'CompanyService', 'handleUpdateCompany');
      }

      // Filter
      const filteredRequest = CompanySecurity.filterCompanyUpdateRequest(req.body);
      // Check email
      const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.id);
      if (!company) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Company with ID '${filteredRequest.id}' does not exist anymore`, 550,
          'CompanyService', 'handleUpdateCompany', req.user);
      }
      // Check Mandatory fields
      CompanyService._checkIfCompanyValid(filteredRequest, req);

      // Check auth
      if (!Authorizations.canUpdateCompany(req.user, company)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_COMPANY,
          company.id,
          560, 'CompanyService', 'handleUpdateCompany',
          req.user);
      }
      // Update
      Database.updateCompany(filteredRequest, company);

      // Update timestamp
      company.lastChangedBy = new User(req.user.tenantID, { 'id': req.user.id });
      company.lastChangedOn = new Date();

      // Update Company
      CompanyStorage.saveCompany(req.user.tenantID, company, true);

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
    if(req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company ID is mandatory`, 500,
        'CompanyService', 'checkIfCompanyValid',
        req.user.id);
    }
    if(!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company Name is mandatory`, 500,
        'CompanyService', 'checkIfCompanyValid',
        req.user.id, filteredRequest.id);
    }
  }


}


