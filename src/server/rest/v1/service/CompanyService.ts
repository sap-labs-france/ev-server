import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppAuthError from '../../../../exception/AppAuthError';
import AuthorizationService from './AuthorizationService';
import Authorizations from '../../../../authorization/Authorizations';
import Company from '../../../../types/Company';
import { CompanyDataResult } from '../../../../types/DataResult';
import CompanySecurity from './security/CompanySecurity';
import CompanyStorage from '../../../../storage/mongodb/CompanyStorage';
import Constants from '../../../../utils/Constants';
import { HTTPAuthError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import TenantComponents from '../../../../types/TenantComponents';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'CompanyService';

export default class CompanyService {

  public static async handleDeleteCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.COMPANY, MODULE_NAME, 'handleDeleteCompany');
    // Filter
    const companyID = CompanySecurity.filterCompanyRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, companyID, MODULE_NAME, 'handleDeleteCompany', req.user);
    // Check and Get Company
    const company = await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, companyID, Action.DELETE, action, {});
    // Delete
    await CompanyStorage.deleteCompany(req.user.tenantID, company.id);
    // Log
    await Logging.logSecurityInfo({
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
    UtilsService.assertIdIsProvided(action, filteredRequest.ID, MODULE_NAME, 'handleGetCompany', req.user);
    // Check and Get Company
    const company = await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, filteredRequest.ID, Action.READ, action, {
        withLogo: true
      }, true);
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
    // Filter
    const filteredRequest = CompanySecurity.filterCompaniesRequest(req.query);
    // Check dynamic auth
    const authorizationCompaniesFilter = await AuthorizationService.checkAndGetCompaniesAuthorizationFilters(
      req.tenant, req.user, filteredRequest);
    if (!authorizationCompaniesFilter.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the companies
    const companies = await CompanyStorage.getCompanies(req.user.tenantID,
      {
        search: filteredRequest.Search,
        issuer: filteredRequest.Issuer,
        withSites: filteredRequest.WithSites,
        withLogo: filteredRequest.WithLogo,
        locCoordinates: filteredRequest.LocCoordinates,
        locMaxDistanceMeters: filteredRequest.LocMaxDistanceMeters,
        ...authorizationCompaniesFilter.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.SortFields,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizationCompaniesFilter.projectFields
    );
    // Add Auth flags
    await AuthorizationService.addCompaniesAuthorizations(req.tenant, req.user, companies as CompanyDataResult, authorizationCompaniesFilter);
    // Return
    res.json(companies);
    next();
  }

  public static async handleCreateCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.CREATE, Entity.COMPANY, MODULE_NAME, 'handleCreateCompany');
    // Check auth
    if (!await Authorizations.canCreateCompany(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.FORBIDDEN,
        user: req.user,
        action: Action.CREATE, entity: Entity.COMPANY,
        module: MODULE_NAME, method: 'handleCreateCompany'
      });
    }
    // Filter
    const filteredRequest = CompanySecurity.filterCompanyCreateRequest(req.body);
    // Check
    UtilsService.checkIfCompanyValid(filteredRequest, req);
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
    await Logging.logSecurityInfo({
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
    UtilsService.assertIdIsProvided(action, filteredRequest.id, MODULE_NAME, 'handleUpdateCompany', req.user);
    // Check Mandatory fields
    UtilsService.checkIfCompanyValid(filteredRequest, req);
    // Check and Get Company
    const company = await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, {});
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
    await Logging.logSecurityInfo({
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
