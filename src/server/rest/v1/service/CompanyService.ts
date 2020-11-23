import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import Company from '../../../../types/Company';
import CompanySecurity from './security/CompanySecurity';
import CompanyStorage from '../../../../storage/mongodb/CompanyStorage';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import TenantComponents from '../../../../types/TenantComponents';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'CompanyService';

export default class CompanyService {

  public static async handleDeleteCompany(action: ServerAction, req: Request, res: Response, next: NextFunction) {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.COMPANY, MODULE_NAME, 'handleDeleteCompany');
    // Filter
    const companyID = CompanySecurity.filterCompanyRequestByID(req.query);
    // Check Mandatory fields
    UtilsService.assertIdIsProvided(action, companyID, MODULE_NAME, 'handleDeleteCompany', req.user);
    // Check auth
    if (!Authorizations.canDeleteCompany(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'handleDeleteCompany',
        value: companyID
      });
    }
    // Get
    const company = await CompanyStorage.getCompany(req.user.tenantID, companyID);
    UtilsService.assertObjectExists(action, company, `Company with ID '${companyID}' does not exist`,
      MODULE_NAME, 'handleDeleteCompany', req.user);
    // OCPI Company
    if (!company.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Company '${company.name}' with ID '${company.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleDeleteCompany',
        user: req.user,
        action: action
      });
    }
    // Delete
    await CompanyStorage.deleteCompany(req.user.tenantID, company.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteCompany',
      message: `Company '${company.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { company }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.COMPANY, MODULE_NAME, 'handleGetCompany');
    // Filter
    const filteredRequest = CompanySecurity.filterCompanyRequest(req.query);
    // ID is mandatory
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetCompany', req.user);
    // Check auth
    if (!Authorizations.canReadCompany(req.user, filteredRequest.ID)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'handleGetCompany',
        value: filteredRequest.ID
      });
    }
    // Get it
    const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.ID,
      [ 'id', 'name', 'issuer', 'logo', 'address' ]);
    UtilsService.assertObjectExists(action, company, `Company with ID '${filteredRequest.ID}' does not exist`,
      MODULE_NAME, 'handleGetCompany', req.user);
    // Return
    res.json(company);
    next();
  }

  public static async handleGetCompanyLogo(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = CompanySecurity.filterCompanyLogoRequest(req.query);
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetCompanyLogo', req.user);
    // Get the Logo
    const companyLogo = await CompanyStorage.getCompanyLogo(filteredRequest.TenantID, filteredRequest.ID);
    // Return
    if (companyLogo?.logo) {
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      // Remove encoding header
      if (companyLogo.logo.startsWith('data:image/')) {
        header = companyLogo.logo.substring(5, companyLogo.logo.indexOf(';'));
        encoding = companyLogo.logo.substring(companyLogo.logo.indexOf(';') + 1, companyLogo.logo.indexOf(',')) as BufferEncoding;
        companyLogo.logo = companyLogo.logo.substring(companyLogo.logo.indexOf(',') + 1);
      }
      res.setHeader('content-type', header);
      res.send(companyLogo.logo ? Buffer.from(companyLogo.logo, encoding) : null);
    } else {
      res.send(null);
    }
    next();
  }

  public static async handleGetCompanies(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.COMPANIES, MODULE_NAME, 'handleGetCompanies');
    // Check auth
    if (!Authorizations.canListCompanies(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.COMPANIES,
        module: MODULE_NAME, method: 'handleGetCompanies'
      });
    }
    // Check User
    let userProject: string[] = [];
    if (Authorizations.canListUsers(req.user)) {
      userProject = [ 'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName' ];
    }
    // Filter
    const filteredRequest = CompanySecurity.filterCompaniesRequest(req.query);
    // Get the companies
    const companies = await CompanyStorage.getCompanies(req.user.tenantID,
      {
        search: filteredRequest.Search,
        issuer: filteredRequest.Issuer,
        companyIDs: Authorizations.getAuthorizedCompanyIDs(req.user),
        withSites: filteredRequest.WithSites,
        withLogo: filteredRequest.WithLogo,
        locCoordinates: filteredRequest.LocCoordinates,
        locMaxDistanceMeters: filteredRequest.LocMaxDistanceMeters,
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount },
      [ 'id', 'name', 'address', 'logo', 'issuer', 'distanceMeters', 'createdOn', 'lastChangedOn', ...userProject ]
    );
    // Return
    res.json(companies);
    next();
  }

  public static async handleCreateCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.CREATE, Entity.COMPANY, MODULE_NAME, 'handleCreateCompany');
    // Check auth
    if (!Authorizations.canCreateCompany(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'handleCreateCompany'
      });
    }
    // Filter
    const filteredRequest = CompanySecurity.filterCompanyCreateRequest(req.body);
    // Check
    Utils.checkIfCompanyValid(filteredRequest, req);
    // Create company
    const newCompany: Company = {
      ...filteredRequest,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Company;
    // Save
    newCompany.id = await CompanyStorage.saveCompany(req.user.tenantID, newCompany);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleCreateCompany',
      message: `Company '${newCompany.id}' has been created successfully`,
      action: action,
      detailedMessages: { company: newCompany }
    });
    // Ok
    res.json(Object.assign({ id: newCompany.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.COMPANY, MODULE_NAME, 'handleUpdateCompany');
    // Filter
    const filteredRequest = CompanySecurity.filterCompanyUpdateRequest(req.body);
    // Check auth
    if (!Authorizations.canUpdateCompany(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'handleUpdateCompany',
        value: filteredRequest.id
      });
    }
    // Get Company
    const company = await CompanyStorage.getCompany(req.user.tenantID, filteredRequest.id);
    UtilsService.assertObjectExists(action, company, `Company with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateCompany', req.user);
    // Check Mandatory fields
    Utils.checkIfCompanyValid(filteredRequest, req);
    // OCPI Company
    if (!company.issuer) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.GENERAL_ERROR,
        message: `Company '${company.name}' with ID '${company.id}' not issued by the organization`,
        module: MODULE_NAME, method: 'handleUpdateCompany',
        user: req.user,
        action: action
      });
    }
    // Update
    company.name = filteredRequest.name;
    company.address = filteredRequest.address;
    if (Utils.objectHasProperty(filteredRequest, 'logo')) {
      company.logo = filteredRequest.logo;
    }
    company.lastChangedBy = { 'id': req.user.id };
    company.lastChangedOn = new Date();
    // Update Company
    await CompanyStorage.saveCompany(req.user.tenantID, company, Utils.objectHasProperty(filteredRequest, 'logo') ? true : false);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateCompany',
      message: `Company '${company.name}' has been updated successfully`,
      action: action,
      detailedMessages: { company }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
