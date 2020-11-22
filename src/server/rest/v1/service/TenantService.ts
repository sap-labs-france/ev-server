import { Action, Entity } from '../../../../types/Authorization';
import { HTTPAuthError, HTTPError } from '../../../../types/HTTPError';
import { NextFunction, Request, Response } from 'express';
import { SettingDB, SettingDBContent } from '../../../../types/Setting';
import User, { UserRole } from '../../../../types/User';

import AppAuthError from '../../../../exception/AppAuthError';
import AppError from '../../../../exception/AppError';
import Authorizations from '../../../../authorization/Authorizations';
import Constants from '../../../../utils/Constants';
import Logging from '../../../../utils/Logging';
import NotificationHandler from '../../../../notification/NotificationHandler';
import { ServerAction } from '../../../../types/Server';
import SettingStorage from '../../../../storage/mongodb/SettingStorage';
import SiteAreaStorage from '../../../../storage/mongodb/SiteAreaStorage';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../../types/Tenant';
import TenantSecurity from './security/TenantSecurity';
import TenantStorage from '../../../../storage/mongodb/TenantStorage';
import TenantValidator from '../validator/TenantValidation';
import UserStorage from '../../../../storage/mongodb/UserStorage';
import Utils from '../../../../utils/Utils';
import UtilsService from './UtilsService';

const MODULE_NAME = 'TenantService';

export default class TenantService {

  public static async handleDeleteTenant(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const id = TenantSecurity.filterTenantRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, id, MODULE_NAME, 'handleDeleteTenant', req.user);
    // Check auth
    if (!Authorizations.canDeleteTenant(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.DELETE, entity: Entity.TENANT,
        module: MODULE_NAME, method: 'handleDeleteTenant',
        value: id
      });
    }
    // Get
    const tenant = await TenantStorage.getTenant(id);
    UtilsService.assertObjectExists(action, tenant, `Tenant with ID '${id}' does not exist`,
      MODULE_NAME, 'handleDeleteTenant', req.user);
    // Check if current tenant
    if (tenant.id === req.user.tenantID) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.OBJECT_DOES_NOT_EXIST_ERROR,
        message: `Your own tenant with id '${tenant.id}' cannot be deleted`,
        module: MODULE_NAME, method: 'handleDeleteTenant',
        user: req.user,
        action: action
      });
    }
    // Delete
    await TenantStorage.deleteTenant(tenant.id);
    // Remove collection
    await TenantStorage.deleteTenantDB(tenant.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleDeleteTenant',
      message: `Tenant '${tenant.name}' has been deleted successfully`,
      action: action,
      detailedMessages: { tenant }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetTenantLogo(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const tenantID = TenantSecurity.filterTenantRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, tenantID, MODULE_NAME, 'handleGetTenantLogo', req.user);
    // Get Logo
    const tenantLogo = await TenantStorage.getTenantLogo(tenantID);
    // Return
    if (tenantLogo?.logo) {
      let header = 'image';
      let encoding: BufferEncoding = 'base64';
      // Remove encoding header
      if (tenantLogo.logo.startsWith('data:image/')) {
        header = tenantLogo.logo.substring(5, tenantLogo.logo.indexOf(';'));
        encoding = tenantLogo.logo.substring(tenantLogo.logo.indexOf(';') + 1, tenantLogo.logo.indexOf(',')) as BufferEncoding;
        tenantLogo.logo = tenantLogo.logo.substring(tenantLogo.logo.indexOf(',') + 1);
      }
      res.setHeader('content-type', header);
      res.send(tenantLogo.logo ? Buffer.from(tenantLogo.logo, encoding) : null);
    } else {
      res.send(null);
    }
    next();
  }

  public static async handleGetTenant(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const tenantID = TenantSecurity.filterTenantRequestByID(req.query);
    UtilsService.assertIdIsProvided(action, tenantID, MODULE_NAME, 'handleGetTenant', req.user);
    // Check auth
    if (!Authorizations.canReadTenant(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.READ, entity: Entity.TENANT,
        module: MODULE_NAME, method: 'handleGetTenant',
        value: tenantID
      });
    }
    // Get it
    const tenant = await TenantStorage.getTenant(tenantID,
      [ 'id', 'name', 'email', 'subdomain', 'components', 'address', 'logo']
    );
    UtilsService.assertObjectExists(action, tenant, `Tenant with ID '${tenantID}' does not exist`,
      MODULE_NAME, 'handleGetTenant', req.user);
    // Return
    res.json(tenant);
    next();
  }

  public static async handleGetTenants(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListTenants(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.LIST, entity: Entity.TENANTS,
        module: MODULE_NAME, method: 'handleGetTenants'
      });
    }
    // Filter
    const filteredRequest = TenantSecurity.filterTenantsRequest(req.query);
    const projectFields = [
      'id', 'name', 'email', 'subdomain', 'logo', 'createdOn', 'createdBy', 'lastChangedOn', 'lastChangedBy'
    ];
    if (filteredRequest.WithComponents) {
      projectFields.push('components');
    }
    // Get the tenants
    const tenants = await TenantStorage.getTenants(
      {
        search: filteredRequest.Search,
        withLogo: filteredRequest.WithLogo,
      },
      { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort },
      projectFields);
    // Return
    res.json(tenants);
    next();
  }

  public static async handleCreateTenant(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Validate
    const filteredRequest = TenantValidator.getInstance().validateTenantCreateRequestSuperAdmin(req.body);
    // Check auth
    if (!Authorizations.canCreateTenant(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.CREATE, entity: Entity.TENANT,
        module: MODULE_NAME, method: 'handleCreateTenant'
      });
    }
    // Check the Tenant's name
    let foundTenant = await TenantStorage.getTenantByName(filteredRequest.name);
    if (foundTenant) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
        message: `The tenant with name '${filteredRequest.name}' already exists`,
        module: MODULE_NAME, method: 'handleCreateTenant',
        user: req.user,
        action: action
      });
    }
    // Get the Tenant with ID (subdomain)
    foundTenant = await TenantStorage.getTenantBySubdomain(filteredRequest.subdomain);
    if (foundTenant) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        errorCode: HTTPError.USER_EMAIL_ALREADY_EXIST_ERROR,
        message: `The tenant with subdomain '${filteredRequest.subdomain}' already exists`,
        module: MODULE_NAME, method: 'handleCreateTenant',
        user: req.user,
        action: action
      });
    }
    // Update timestamp
    filteredRequest.createdBy = { 'id': req.user.id };
    filteredRequest.createdOn = new Date();
    // Save
    filteredRequest.id = await TenantStorage.saveTenant(filteredRequest);
    // Update with components
    await TenantService.updateSettingsWithComponents(filteredRequest, req);
    // Create DB collections
    await TenantStorage.createTenantDB(filteredRequest.id);
    // Create Admin user in tenant
    const tenantUser: User = UserStorage.createNewUser() as User;
    tenantUser.name = filteredRequest.name;
    tenantUser.firstName = 'Admin';
    tenantUser.email = filteredRequest.email;
    // Save User
    tenantUser.id = await UserStorage.saveUser(filteredRequest.id, tenantUser);
    // Save User Role
    await UserStorage.saveUserRole(filteredRequest.id, tenantUser.id, UserRole.ADMIN);
    // Save User Status
    await UserStorage.saveUserStatus(filteredRequest.id, tenantUser.id, tenantUser.status);
    // Save User Account Verification
    const verificationToken = Utils.generateToken(filteredRequest.email);
    await UserStorage.saveUserAccountVerification(filteredRequest.id, tenantUser.id, { verificationToken });
    const resetHash = Utils.generateUUID();
    // Init Password info
    await UserStorage.saveUserPassword(filteredRequest.id, tenantUser.id, { passwordResetHash: resetHash });
    // Send activation link
    const evseDashboardVerifyEmailURL = Utils.buildEvseURL(filteredRequest.subdomain) +
      '/verify-email?VerificationToken=' + verificationToken + '&Email=' +
      tenantUser.email + '&ResetToken=' + resetHash;
    // Send Register User (Async)
    NotificationHandler.sendNewRegisteredUser(
      filteredRequest.id,
      Utils.generateUUID(),
      tenantUser,
      {
        'tenant': filteredRequest.name,
        'user': tenantUser,
        'evseDashboardURL': Utils.buildEvseURL(filteredRequest.subdomain),
        'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
      }
    ).catch(() => { });
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleCreateTenant',
      message: `Tenant '${filteredRequest.name}' has been created successfully`,
      action: action,
      detailedMessages: { params: filteredRequest }
    });
    // Ok
    res.status(StatusCodes.OK).json(Object.assign({ id: filteredRequest.id }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleUpdateTenant(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check
    const filteredRequest = TenantValidator.getInstance().validateTenantUpdateRequestSuperAdmin(req.body);
    // Check auth
    if (!Authorizations.canUpdateTenant(req.user)) {
      throw new AppAuthError({
        errorCode: HTTPAuthError.ERROR,
        user: req.user,
        action: Action.UPDATE, entity: Entity.TENANT,
        module: MODULE_NAME, method: 'handleUpdateTenant',
        value: filteredRequest.id
      });
    }
    // Get
    const tenant = await TenantStorage.getTenant(filteredRequest.id);
    UtilsService.assertObjectExists(action, tenant, `Tenant with ID '${filteredRequest.id}' does not exist`,
      MODULE_NAME, 'handleUpdateTenant', req.user);
    // Check if smart charging is deactivated in all site areas when deactivated in super tenant
    if (filteredRequest.components && filteredRequest.components.smartCharging &&
        tenant.components && tenant.components.smartCharging &&
        !filteredRequest.components.smartCharging.active && tenant.components.smartCharging.active) {
      const siteAreas = await SiteAreaStorage.getSiteAreas(filteredRequest.id, { smartCharging: true }, Constants.DB_PARAMS_MAX_LIMIT);
      if (siteAreas.count !== 0) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          errorCode: HTTPError.SMART_CHARGING_STILL_ACTIVE_FOR_SITE_AREA,
          message: 'Site Area(s) is/are still enabled for Smart Charging. Please deactivate it/them to disable Smart Charging in Tenant',
          module: MODULE_NAME,
          method: 'handleUpdateSetting',
          user: req.user,
          detailedMessages: { siteAreas: siteAreas.result.map((siteArea) => `${siteArea.name} (${siteArea.id})`) },
        });
      }
    }
    tenant.name = filteredRequest.name;
    tenant.address = filteredRequest.address;
    tenant.components = filteredRequest.components;
    tenant.email = filteredRequest.email;
    tenant.subdomain = filteredRequest.subdomain;
    if (Utils.objectHasProperty(filteredRequest, 'logo')) {
      tenant.logo = filteredRequest.logo;
    }
    // Update timestamp
    tenant.lastChangedBy = { 'id': req.user.id };
    tenant.lastChangedOn = new Date();
    // Update Tenant
    await TenantStorage.saveTenant(tenant, Utils.objectHasProperty(filteredRequest, 'logo') ? true : false);
    // Update with components
    await TenantService.updateSettingsWithComponents(filteredRequest, req);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleUpdateTenant',
      message: `Tenant '${filteredRequest.name}' has been updated successfully`,
      action: action,
      detailedMessages: { tenant }
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async updateSettingsWithComponents(tenant: Partial<Tenant>, req: Request): Promise<void> {
    // Create settings
    for (const componentName in tenant.components) {
      // Get the settings
      const currentSetting = await SettingStorage.getSettingByIdentifier(tenant.id, componentName);
      // Check if Component is active
      if (!tenant.components[componentName] || !tenant.components[componentName].active) {
        // Delete settings
        if (currentSetting) {
          await SettingStorage.deleteSetting(tenant.id, currentSetting.id);
        }
        continue;
      }
      // Create
      const newSettingContent: SettingDBContent = Utils.createDefaultSettingContent(
        {
          ...tenant.components[componentName],
          name: componentName
        }, (currentSetting ? currentSetting.content : null));
      if (newSettingContent) {
        // Create & Save
        if (!currentSetting) {
          const newSetting: SettingDB = {
            identifier: componentName,
            content: newSettingContent
          } as SettingDB;
          newSetting.createdOn = new Date();
          newSetting.createdBy = { 'id': req.user.id };
          // Save Setting
          await SettingStorage.saveSettings(tenant.id, newSetting);
        } else {
          currentSetting.content = newSettingContent;
          currentSetting.lastChangedOn = new Date();
          currentSetting.lastChangedBy = { 'id': req.user.id };
          // Save Setting
          await SettingStorage.saveSettings(tenant.id, currentSetting);
        }
      }
    }
  }
}
