import { NextFunction, Request, Response } from 'express';
import HttpStatusCodes from 'http-status-codes';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import ConflictError from '../../../exception/ConflictError';
import Constants from '../../../utils/Constants';
import Database from '../../../utils/Database';
import Logging from '../../../utils/Logging';
import NotificationHandler from '../../../notification/NotificationHandler';
import Setting from '../../../entity/Setting';
import Tenant from '../../../entity/Tenant';
import TenantSecurity from './security/TenantSecurity';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import TenantValidator from '../validation/TenantValidation';
import User from '../../../types/User';
import Utils from '../../../utils/Utils';
import UserService from './UserService';
import UserStorage from '../../../storage/mongodb/UserStorage';

const MODULE_NAME = 'TenantService';

export default class TenantService {

  static async handleDeleteTenant(action, req, res, next) {
    // Filter
    const filteredRequest = TenantSecurity.filterTenantDeleteRequest(req.query, req.user);
    // Check Mandatory fields
    if (!filteredRequest.ID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Tenant\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        MODULE_NAME, 'handleDeleteTenant', req.user);
    }
    // Get
    const tenant = await Tenant.getTenant(filteredRequest.ID);
    // Found?
    if (!tenant) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Tenant with ID '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        MODULE_NAME, 'handleDeleteTenant', req.user);
    }
    // Check auth
    if (!Authorizations.canDeleteTenant(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_TENANT,
        filteredRequest.ID,
        Constants.HTTP_AUTH_ERROR,
        'TenantService', 'handleDeleteTenant',
        req.user);
    }
    if (tenant.getID() === req.user.tenantID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Your own tenant with id '${tenant.getID()}' cannot be deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        MODULE_NAME, 'handleDeleteTenant', req.user);
    }
    // Delete
    await TenantStorage.deleteTenant(tenant.getID());
    if (filteredRequest.forced && !Utils.isServerInProductionMode()) {
      Logging.logWarning({
        tenantID: req.user.tenantID,
        module: 'MongoDBStorage', method: 'deleteTenantDatabase',
        message: `Deleting collections for tenant ${tenant.getID()}`
      });
      TenantStorage.deleteTenantDB(tenant.getID());
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleDeleteTenant',
      message: `Tenant '${tenant.getName()}' has been deleted successfully`,
      action: action,
      detailedMessages: tenant
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  static async handleGetTenant(action, req, res, next) {
    // Filter
    const filteredRequest = TenantSecurity.filterTenantRequest(req.query, req.user);

    // Charge Box is mandatory
    if (!filteredRequest.ID) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Tenant\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        MODULE_NAME, 'handleGetTenant', req.user);
    }
    // Get it
    const tenant = await Tenant.getTenant(filteredRequest.ID);
    if (!tenant) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Tenant with ID '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        MODULE_NAME, 'handleGetTenant', req.user);
    }
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

    // Return
    res.json(
      // Filter
      TenantSecurity.filterTenantResponse(
        tenant.getModel(), req.user)
    );
    next();
  }

  static async handleGetTenants(action, req, res, next) {
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
    const filteredRequest = TenantSecurity.filterTenantsRequest(req.query, req.user);
    // Get the tenants
    const tenants = await Tenant.getTenants(
      {
        search: filteredRequest.Search
      },
      filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
    // Set
    tenants.result = tenants.result.map((tenant) => {
      return tenant.getModel();
    });
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
    const filteredRequest = TenantSecurity.filterTenantCreateRequest(req.body, req.user);
    // Check the Tenant's name
    let foundTenant = await Tenant.getTenantByName(filteredRequest.name);
    if (foundTenant) {
      throw new ConflictError(`The tenant with name '${filteredRequest.name}' already exists`, 'tenants.name_already_used',
        {
          'name': filteredRequest.name,
          'module': MODULE_NAME,
          'source': 'handleCreateTenant',
          'user': req.user,
          'action': action
        });
    }
    // Get the Tenant with ID (subdomain)
    foundTenant = await Tenant.getTenantBySubdomain(filteredRequest.subdomain);
    if (foundTenant) {
      throw new ConflictError(`The tenant with subdomain '${filteredRequest.subdomain}' already exists`, 'tenants.subdomain_already_used', {
        'subdomain': filteredRequest.subdomain
      });
    }
    // Create
    const tenant = new Tenant(filteredRequest);
    // Update timestamp
    tenant.setCreatedBy({
      'id': req.user.id
    });
    tenant.setCreatedOn(new Date());
    // Save
    const newTenant = await TenantStorage.saveTenant(tenant.getModel());
    // Update with components
    TenantService._updateSettingsWithComponents(newTenant, req);
    // Create DB collections
    TenantStorage.createTenantDB(newTenant.getID());
    // Create user in tenant
    const password = UserService.generatePassword();
    const verificationToken = Utils.generateToken(newTenant.getEmail());
    let tenantUser: User = UserStorage.getEmptyUser();
    tenantUser.name = newTenant.getName();
    tenantUser.firstName = 'Admin';
    tenantUser.password = await UserService.hashPasswordBcrypt(password);
    tenantUser.role = Constants.ROLE_ADMIN;
    tenantUser.email = newTenant.getEmail();
    tenantUser.verificationToken = verificationToken;

    // Save
    const newUserId = await UserStorage.saveUser(newTenant.getID(), tenantUser);
    // Send activation link
    const evseDashboardVerifyEmailURL = Utils.buildEvseURL(newTenant.getSubdomain()) +
      '/#/verify-email?VerificationToken=' + verificationToken + '&Email=' +
      tenantUser.email;
    NotificationHandler.sendNewRegisteredUser(
      newTenant.getID(),
      Utils.generateGUID(),
      tenantUser,
      {
        'user': tenantUser,
        'evseDashboardURL': Utils.buildEvseURL(newTenant.getSubdomain()),
        'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
      },
      tenantUser.locale
    );
    // Send temporary password
    NotificationHandler.sendNewPassword(
      newTenant.getID(),
      Utils.generateGUID(),
      tenantUser,
      {
        'user': tenantUser,
        'hash': null,
        'newPassword': password,
        'evseDashboardURL': Utils.buildEvseURL(newTenant.getSubdomain())
      },
      tenantUser.locale
    );
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleCreateTenant',
      message: `Tenant '${newTenant.getName()}' has been created successfully`,
      action: action,
      detailedMessages: newTenant
    });
    // Ok
    res.status(HttpStatusCodes.OK).json(Object.assign({ id: newTenant.getID() }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  static async handleUpdateTenant(action, req, res, next) {
    // Check
    TenantValidator.getInstance().validateTenantUpdate(req.body);
    // Filter
    const filteredRequest = TenantSecurity.filterTenantUpdateRequest(req.body, req.user);
    // Check email
    const tenant = await Tenant.getTenant(filteredRequest.id);
    if (!tenant) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Tenant with ID '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        MODULE_NAME, 'handleUpdateTenant', req.user);
    }
    // Check auth
    if (!Authorizations.canUpdateTenant(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_TENANT,
        filteredRequest.ID,
        Constants.HTTP_AUTH_ERROR,
        'TenantService', 'handleUpdateTenant',
        req.user);
    }
    // Update
    Database.updateTenant(filteredRequest, tenant.getModel());
    // Update timestamp
    tenant.setLastChangedBy({
      'id': req.user.id
    });
    tenant.setLastChangedOn(new Date());
    // Update Tenant
    const updatedTenant = await TenantStorage.saveTenant(tenant.getModel());
    // Update with components
    await TenantService._updateSettingsWithComponents(tenant, req);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID, user: req.user,
      module: MODULE_NAME, method: 'handleUpdateTenant',
      message: `Tenant '${updatedTenant.getName()}' has been updated successfully`,
      action: action,
      detailedMessages: updatedTenant
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  private static async _updateSettingsWithComponents(tenant, req) {
    // Get the user
    const user = await UserStorage.getUser(req.user.tenantID, req.user.id);
    // Create settings
    for (const component of tenant.getComponents()) {
      // Get the settings
      const currentSetting = await Setting.getSettingByIdentifier(tenant.getID(), component.name);
      // Check if Component is active
      if (!component.active) {
        // Delete settings
        if (currentSetting) {
          await currentSetting.delete();
        }
        continue;
      }
      // Create
      const newSettingContent = Setting.createDefaultSettingContent(
        component, (currentSetting ? currentSetting.getContent() : null));
      if (newSettingContent) {
        // Create & Save
        if (!currentSetting) {
          const newSetting = new Setting(tenant.getID(), {
            identifier: component.name,
            content: newSettingContent
          });
          newSetting.setCreatedOn(new Date());
          newSetting.setCreatedBy(user);
          // Save Setting
          await newSetting.save();
        } else {
          currentSetting.setContent(newSettingContent);
          currentSetting.setLastChangedOn(new Date());
          currentSetting.setLastChangedBy(user);
          // Save Setting
          await currentSetting.save();
        }
      }
    }
  }
}
