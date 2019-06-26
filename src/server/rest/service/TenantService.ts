import Logging from '../../../utils/Logging';
import Database from '../../../utils/Database';
import AppError from '../../../exception/AppError';
import UnauthorizedError from '../../../exception/UnauthorizedError';
import ConflictError from '../../../exception/ConflictError';
import Constants from '../../../utils/Constants';
import Tenant from '../../../entity/Tenant';
import User from '../../../entity/User';
import Setting from '../../../entity/Setting';
import Authorizations from '../../../authorization/Authorizations';
import TenantSecurity from './security/TenantSecurity';
import HttpStatusCodes from 'http-status-codes';
import TenantValidator from '../validation/TenantValidation';
import AbstractService from './AbstractService';
import NotificationHandler from '../../../notification/NotificationHandler';
import Utils from '../../../utils/Utils';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import { NextFunction, Request, Response } from 'express';

const MODULE_NAME = 'TenantService';

export default class TenantService extends AbstractService {

  static async handleDeleteTenant(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = TenantSecurity.filterTenantDeleteRequest(
        req.query, req.user);
      // Check Mandatory fields
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Tenant's ID must be provided`, Constants.HTTP_GENERAL_ERROR,
          MODULE_NAME, 'handleDeleteTenant', req.user);
      }
      // Get
      const tenant = await Tenant.getTenant(filteredRequest.ID);
      // Found?
      if (!tenant) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Tenant with ID '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          MODULE_NAME, 'handleDeleteTenant', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteTenant(req.user)) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_TENANT,
          tenant.getID(),
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
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleDeleteTenant');
    }
  }

  static async handleGetTenant(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = TenantSecurity.filterTenantRequest(req.query, req.user);

      // Charge Box is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Tenant's ID must be provided`, Constants.HTTP_GENERAL_ERROR,
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
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_READ,
          Constants.ENTITY_TENANT,
          tenant.getID(),
          req.user);
      }

      // Return
      res.json(
        // Filter
        TenantSecurity.filterTenantResponse(
          tenant.getModel(), req.user)
      );
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleGetTenant');
    }
  }

  static async handleGetTenants(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListTenants(req.user)) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_LIST,
          Constants.ENTITY_TENANTS,
          null,
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
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleGetTenants');
    }
  }

  public static async handleCreateTenant(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check auth
      if (!Authorizations.canCreateTenant(req.user)) {
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_TENANT,
          null,
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
      tenant.setCreatedBy(new User(req.user.tenantID, {
        'id': req.user.id
      }));
      tenant.setCreatedOn(new Date());
      // Save
      const newTenant = await TenantStorage.saveTenant(tenant.getModel());
      // Update with components
      TenantService.updateSettingsWithComponents(newTenant, req);
      // Create DB collections
      TenantStorage.createTenantDB(newTenant.getID());
      // Create user in tenant
      const password = User.generatePassword();
      const verificationToken = Utils.generateToken(newTenant.getEmail());
      const tenantUser = new User(newTenant.getID(), {
        name: newTenant.getName(),
        firstName: "Admin",
        password: await User.hashPasswordBcrypt(password),
        status: Constants.USER_STATUS_PENDING,
        role: Constants.ROLE_ADMIN,
        email: newTenant.getEmail(),
        createdOn: new Date().toISOString(),
        verificationToken: verificationToken
      });
      // Save
      const newUser = await tenantUser.save();
      // Send activation link
      const evseDashboardVerifyEmailURL = Utils.buildEvseURL(newTenant.getSubdomain()) +
        '/#/verify-email?VerificationToken=' + verificationToken + '&Email=' +
        newUser.getEMail();
      NotificationHandler.sendNewRegisteredUser(
        newUser.getTenantID(),
        Utils.generateGUID(),
        newUser.getModel(),
        {
          'user': newUser.getModel(),
          'evseDashboardURL': Utils.buildEvseURL(newTenant.getSubdomain()),
          'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
        },
        newUser.getLocale()
      );
      // Send temporary password
      NotificationHandler.sendNewPassword(
        newUser.getTenantID(),
        Utils.generateGUID(),
        newUser.getModel(),
        {
          'user': newUser.getModel(),
          'hash': null,
          'newPassword': password,
          'evseDashboardURL': Utils.buildEvseURL(newTenant.getSubdomain())
        },
        newUser.getLocale()
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
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleCreateTenant');
    }
  }

  static async handleUpdateTenant(action, req, res, next) {
    try {
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
        // Not Authorized!
        throw new UnauthorizedError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_TENANT,
          tenant.getID(),
          req.user);
      }
      // Update
      Database.updateTenant(filteredRequest, tenant.getModel());
      // Update timestamp
      tenant.setLastChangedBy(new User(req.user.tenantID, {
        'id': req.user.id
      }));
      tenant.setLastChangedOn(new Date());
      // Update Tenant
      const updatedTenant = await TenantStorage.saveTenant(tenant.getModel());
      // Update with components
      TenantService.updateSettingsWithComponents(tenant, req);
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
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleUpdateTenant');
    }
  }

  static async updateSettingsWithComponents(tenant, req) {
    // Get the user
    const user = await User.getUser(req.user.tenantID, req.user.id);
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
