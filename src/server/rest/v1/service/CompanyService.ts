import { Action, Entity } from '../../../../types/Authorization';
import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../exception/AppError';
import AuthorizationService from './AuthorizationService';
import BillingStorage from '../../../../storage/mongodb/BillingStorage';
import Company from '../../../../types/Company';
import { CompanyDataResult } from '../../../../types/DataResult';
import CompanyStorage from '../../../../storage/mongodb/CompanyStorage';
import CompanyValidatorRest from '../validator/CompanyValidatorRest';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import { ServerAction } from '../../../../types/Server';
import { StatusCodes } from 'http-status-codes';
import { TenantComponents } from '../../../../types/Tenant';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'CompanyService';

export default class CompanyService {
  public static async handleDeleteCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.DELETE, Entity.COMPANY, MODULE_NAME, 'handleDeleteCompany');
    // Filter
    const companyID = CompanyValidatorRest.getInstance().validateCompanyDeleteReq(req.query).ID;
    // Check and Get Company
    const company = await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, companyID, Action.DELETE, action);
    // Delete
    await CompanyStorage.deleteCompany(req.tenant, company.id);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleDeleteCompany',
      message: `Company '${company.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { company }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.READ, Entity.COMPANY, MODULE_NAME, 'handleGetCompany');
    // Filter
    const filteredRequest = CompanyValidatorRest.getInstance().validateCompanyGetReq(req.query);
    // Check and Get Company
    const company = await UtilsService.checkAndGetCompanyAuthorization(req.tenant, req.user, filteredRequest.ID, Action.READ, action, null,
      { withLogo: true }, true);
    res.json(company);
    next();
  }

  public static async handleGetCompanyLogo(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check Tenant
    if (!req.tenant) {
      throw new AppError({
        errorCode: StatusCodes.BAD_REQUEST,
        message: 'Tenant must be provided',
        module: MODULE_NAME, method: 'handleGetCompanyLogo', action: action,
      });
    }
    // Filter
    const filteredRequest = CompanyValidatorRest.getInstance().validateCompanyLogoGetReq(req.query);
    // Get the Logo
    const companyLogo = await CompanyStorage.getCompanyLogo(req.tenant, filteredRequest.ID);
    let logo = companyLogo?.logo;
    if (logo) {
      // Header
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      if (logo.startsWith('data:image/')) {
        header = logo.substring(5, logo.indexOf(';'));
        encoding = logo.substring(logo.indexOf(';') + 1, logo.indexOf(',')) as BufferEncoding;
        logo = logo.substring(logo.indexOf(',') + 1);
      }
      res.setHeader('Content-Type', header);
      res.send(Buffer.from(logo, encoding));
    } else {
      res.status(StatusCodes.NOT_FOUND);
    }
    next();
  }

  public static async handleGetCompanies(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.LIST, Entity.COMPANY, MODULE_NAME, 'handleGetCompanies');
    // Filter
    const filteredRequest = CompanyValidatorRest.getInstance().validateCompaniesGetReq(req.query);
    // Create GPS Coordinates
    if (filteredRequest.LocLongitude && filteredRequest.LocLatitude) {
      filteredRequest.LocCoordinates = [
        Utils.convertToFloat(filteredRequest.LocLongitude),
        Utils.convertToFloat(filteredRequest.LocLatitude)
      ];
    }
    // Check dynamic auth
    const authorizations = await AuthorizationService.checkAndGetCompaniesAuthorizations(
      req.tenant, req.user, filteredRequest, false);
    if (!authorizations.authorized) {
      UtilsService.sendEmptyDataResult(res, next);
      return;
    }
    // Get the companies
    const companies = await CompanyStorage.getCompanies(req.tenant,
      {
        search: filteredRequest.Search,
        issuer: filteredRequest.Issuer,
        withSite: filteredRequest.WithSite,
        withLogo: filteredRequest.WithLogo,
        locCoordinates: filteredRequest.LocCoordinates,
        locMaxDistanceMeters: filteredRequest.LocMaxDistanceMeters,
        ...authorizations.filters
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: UtilsService.httpSortFieldsToMongoDB(filteredRequest.SortFields),
        onlyRecordCount: filteredRequest.OnlyRecordCount
      },
      authorizations.projectFields
    );
    // Assign projected fields
    if (authorizations.projectFields) {
      companies.projectFields = authorizations.projectFields;
    }
    // Add Auth flags
    if (filteredRequest.WithAuth) {
      await AuthorizationService.addCompaniesAuthorizations(req.tenant, req.user, companies as CompanyDataResult, authorizations);
    }
    res.json(companies);
    next();
  }

  public static async handleCreateCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.CREATE, Entity.COMPANY, MODULE_NAME, 'handleCreateCompany');
    // Filter
    const filteredRequest = CompanyValidatorRest.getInstance().validateCompanyCreateReq(req.body);
    // Get dynamic auth
    await AuthorizationService.checkAndGetCompanyAuthorizations(
      req.tenant, req.user, {}, Action.CREATE, filteredRequest);
    // Create company
    const newCompany: Company = {
      ...filteredRequest,
      issuer: true,
      createdBy: { id: req.user.id },
      createdOn: new Date()
    } as Company;
    // Connected Account
    if (filteredRequest.accountData) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
        Action.CREATE, Entity.COMPANY, MODULE_NAME, 'handleCreateCompany');
      if (filteredRequest.accountData.accountID) {
        const billingAccount = await BillingStorage.getAccountByID(req.tenant, filteredRequest.accountData.accountID);
        UtilsService.assertObjectExists(action, billingAccount, `Billing Account ID '${filteredRequest.accountData.accountID}' does not exist`, MODULE_NAME, 'handleCreateCompany', req.user);
      }
    }
    // Save
    newCompany.id = await CompanyStorage.saveCompany(req.tenant, newCompany);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleCreateCompany',
      message: `Company '${newCompany.id}' has been created successfully`,
      action: action,
      detailedMessages: { company: newCompany }
    });
    res.json(Object.assign({ id: newCompany.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateCompany(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check if component is active
    UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.ORGANIZATION,
      Action.UPDATE, Entity.COMPANY, MODULE_NAME, 'handleUpdateCompany');
    // Filter
    const filteredRequest = CompanyValidatorRest.getInstance().validateCompanyUpdateReq(req.body);
    // Check and Get Company
    const company = await UtilsService.checkAndGetCompanyAuthorization(
      req.tenant, req.user, filteredRequest.id, Action.UPDATE, action, filteredRequest);
    // Update
    company.name = filteredRequest.name;
    company.address = filteredRequest.address;
    if (Utils.objectHasProperty(filteredRequest, 'logo')) {
      company.logo = filteredRequest.logo;
    }
    // Connected Account
    if (filteredRequest.accountData) {
      UtilsService.assertComponentIsActiveFromToken(req.user, TenantComponents.BILLING_PLATFORM,
        Action.UPDATE, Entity.COMPANY, MODULE_NAME, 'handleUpdateCompany');
      if (filteredRequest.accountData.accountID) {
        const billingAccount = await BillingStorage.getAccountByID(req.tenant, filteredRequest.accountData.accountID);
        UtilsService.assertObjectExists(action, billingAccount, `Billing Account ID '${filteredRequest.accountData.accountID}' does not exist`, MODULE_NAME, 'handleUpdateCompany', req.user);
      }
      company.accountData = filteredRequest.accountData;
    }
    company.lastChangedBy = { 'id': req.user.id };
    company.lastChangedOn = new Date();
    // Update Company
    await CompanyStorage.saveCompany(req.tenant, company, Utils.objectHasProperty(filteredRequest, 'logo') ? true : false);
    await Logging.logInfo({
      tenantID: req.tenant.id,
      user: req.user, module: MODULE_NAME, method: 'handleUpdateCompany',
      message: `Company '${company.name}' has been updated successfully`,
      action: action,
      detailedMessages: { company }
    });
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }
}
