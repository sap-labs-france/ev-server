import { NextFunction, Request, Response } from 'express';
import HttpStatusCodes from 'http-status-codes';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import NotificationHandler from '../../../notification/NotificationHandler';
import Setting from '../../../entity/Setting';
import Tenant from '../../../types/Tenant';
import TenantSecurity from './security/TenantSecurity';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import TenantValidator from '../validation/TenantValidation';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'TenantService';

export default class TenantService {

  public static async handleDeleteTenant(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const tenantID = TenantSecurity.filterTenantDeleteRequest(req.query);
    UtilsService.assertIdIsProvided(tenantID, MODULE_NAME, 'handleDeleteTenant', req.user);
    // Check auth
    if (!Authorizations.canDeleteTenant(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_TENANT,
        tenantID,
        Constants.HTTP_AUTH_ERROR,
        'TenantService', 'handleDeleteTenant',
        req.user);
    }
    // Get
    const tenant = await TenantStorage.getTenant(tenantID);
    // Found?
    UtilsService.assertObjectExists(tenant, `Tenant '${tenantID}' does not exist`,
      MODULE_NAME, 'handleDeleteTenant', req.user);
    // Check if current tenant
    if (tenant.id === req.user.tenantID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Your own tenant with id '${tenant.id}' cannot be deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        MODULE_NAME, 'handleDeleteTenant', req.user);
    }
    // Delete
    await TenantStorage.deleteTenant(tenant.id);
    if (filteredRequest.forced && !Utils.isServerInProductionMode()) {
      Logging.logWarning({
        tenantID: req.user.tenantID,
        module: 'MongoDBStorage', method: 'deleteTenantDatabase',
        message: `Deleting collections for tenant ${tenant.id}`
      });
      await TenantStorage.deleteTenantDB(tenant.id);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleDeleteTenant',
      message: `Tenant '${tenant.name}' has been deleted successfully`,
      action: action,
      detailedMessages: tenant
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetTenant(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = TenantSecurity.filterTenantRequestByID(req.query);
    UtilsService.assertIdIsProvided(filteredRequest.ID, MODULE_NAME, 'handleGetTenant', req.user);
    // Check auth
    if (!Authorizations.canReadTenant(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_TENANT,
        filteredRequest.ID,
        Constants.HTTP_AUTH_ERROR,
        'TenantService', 'handleGetTenant',
        req.user);
    }
    // Get it
    const tenant = await TenantStorage.getTenant(filteredRequest.ID);
    UtilsService.assertObjectExists(tenant, `Tenant '${filteredRequest.ID}' doesn't exist.`, MODULE_NAME, 'handleGetTenant', req.user);
    // Return
    res.json(
      // Filter
      TenantSecurity.filterTenantResponse(
        tenant, req.user)
    );
    next();
  }

  public static async handleGetTenants(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTenants(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_TENANTS,
        null,
        Constants.HTTP_AUTH_ERROR,
        'TenantService', 'handleGetTenants',
        req.user);
    }
    // Filter
    const filteredRequest = TenantSecurity.filterTenantsRequest(req.query);
    // Get the tenants
    const tenants = await TenantStorage.getTenants(
      { search: filteredRequest.Search },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort });
    // Filter
    TenantSecurity.filterTenantsResponse(tenants, req.user);
    // Return
    res.json(tenants);
    next();
  }

  public static async handleCreateTenant(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canCreateTenant(req.user)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_CREATE,
        Constants.ENTITY_TENANT,
        null,
        Constants.HTTP_AUTH_ERROR,
        'TenantService',
        'handleCreateTenant',
        req.user);
    }
    TenantValidator.getInstance().validateTenantCreation(req.body);
    // Filter
    const filteredRequest = TenantSecurity.filterTenantRequest(req.body);
    // Check the Tenant's name
    let foundTenant = await TenantStorage.getTenantByName(filteredRequest.name);
    if (foundTenant) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The tenant with name '${filteredRequest.name}' already exists`,
        Constants.HTTP_USER_EMAIL_ALREADY_EXIST_ERROR,
        MODULE_NAME, 'handleCreateTenant', req.user, null, action);
    }
    // Get the Tenant with ID (subdomain)
    foundTenant = await TenantStorage.getTenantBySubdomain(filteredRequest.subdomain);
    if (foundTenant) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The tenant with subdomain '${filteredRequest.subdomain}' already exists`,
        Constants.HTTP_USER_EMAIL_ALREADY_EXIST_ERROR,
        MODULE_NAME, 'handleCreateTenant', req.user, null, action);
    }
    // Update timestamp
    filteredRequest.createdBy = { 'id': req.user.id };
    filteredRequest.createdOn = new Date();
    // Save
    filteredRequest.id = await TenantStorage.saveTenant(filteredRequest);
    // Update with components
    await TenantService._updateSettingsWithComponents(filteredRequest, req);
    // Create DB collections
    await TenantStorage.createTenantDB(filteredRequest.id);
    // Create user in tenant
    const password = Utils.generatePassword();
    const verificationToken = Utils.generateToken(filteredRequest.email);
    const tenantUser: User = UserStorage.getEmptyUser();
    tenantUser.name = filteredRequest.name;
    tenantUser.firstName = 'Admin';
    tenantUser.password = await Utils.hashPasswordBcrypt(password);
    tenantUser.role = Constants.ROLE_ADMIN;
    tenantUser.email = filteredRequest.email;
    tenantUser.verificationToken = verificationToken;
    // Save
    tenantUser.id = await UserStorage.saveUser(filteredRequest.id, tenantUser);
    // Send activation link
    const evseDashboardVerifyEmailURL = Utils.buildEvseURL(filteredRequest.subdomain) +
      '/#/verify-email?VerificationToken=' + verificationToken + '&Email=' +
      tenantUser.email;
    // Send Register User (Async)
    NotificationHandler.sendNewRegisteredUser(
      filteredRequest.id,
      Utils.generateGUID(),
      tenantUser,
      {
        'user': tenantUser,
        'evseDashboardURL': Utils.buildEvseURL(filteredRequest.subdomain),
        'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
      },
      tenantUser.locale
    );
    // Send password (Async)
    NotificationHandler.sendNewPassword(
      filteredRequest.id,
      Utils.generateGUID(),
      tenantUser,
      {
        'user': tenantUser,
        'hash': null,
        'newPassword': password,
        'evseDashboardURL': Utils.buildEvseURL(filteredRequest.subdomain)
      },
      tenantUser.locale
    );
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleCreateTenant',
      message: `Tenant '${filteredRequest.name}' has been created successfully`,
      action: action,
      detailedMessages: filteredRequest
    });
    // Ok
    res.status(HttpStatusCodes.OK).json(Object.assign({ id: filteredRequest.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateTenant(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check
    TenantValidator.getInstance().validateTenantUpdate(req.body);
    // Filter
    const tenantUpdate = TenantSecurity.filterTenantRequest(req.body);
    // Check auth
    if (!Authorizations.canUpdateTenant(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_TENANT,
        tenantUpdate.id,
        Constants.HTTP_AUTH_ERROR,
        'TenantService', 'handleUpdateTenant',
        req.user);
    }
    // Get
    const tenant = await TenantStorage.getTenant(tenantUpdate.id);
    UtilsService.assertObjectExists(tenant, `Tenant '${tenantUpdate.id}' doesn't exist.`, MODULE_NAME, 'handleUpdateTenant', req.user);
    // Update timestamp
    tenantUpdate.lastChangedBy = { 'id': req.user.id };
    tenantUpdate.lastChangedOn = new Date();
    // Update Tenant
    await TenantStorage.saveTenant(tenantUpdate);
    // Update with components
    await TenantService._updateSettingsWithComponents(tenantUpdate, req);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleUpdateTenant',
      message: `Tenant '${tenantUpdate.name}' has been updated successfully`,
      action: action,
      detailedMessages: tenantUpdate
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async _updateSettingsWithComponents(tenant: Partial<Tenant>, req: Request) {
    // Create settings
    for (const componentName in tenant.components) {
      // Get the settings
      const currentSetting = await Setting.getSettingByIdentifier(tenant.id, componentName);
      // Check if Component is active
      if (!tenant.components[componentName] || !tenant.components[componentName].active) {
        // Delete settings
        if (currentSetting) {
          await currentSetting.delete();
        }
        continue;
      }
      // Create
      const newSettingContent = Setting.createDefaultSettingContent(
        { ...tenant.components[componentName], name: componentName }, (currentSetting ? currentSetting.getContent() : null));
      if (newSettingContent) {
        // Create & Save
        if (!currentSetting) {
          const newSetting = new Setting(tenant.id, {
            identifier: componentName,
            content: newSettingContent
          });
          newSetting.setCreatedOn(new Date());
          newSetting.setCreatedBy({
            'id': req.user.id
          });
          // Save Setting
          await newSetting.save();
        } else {
          currentSetting.setContent(newSettingContent);
          currentSetting.setLastChangedOn(new Date());
          currentSetting.setLastChangedBy({
            'id': req.user.id
          });
          // Save Setting
          await currentSetting.save();
        }
      }
    }
  }
}
