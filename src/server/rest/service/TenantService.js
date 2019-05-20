const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const UnauthorizedError = require('../../../exception/UnauthorizedError');
const ConflictError = require('../../../exception/ConflictError');
const Constants = require('../../../utils/Constants');
const Tenant = require('../../../entity/Tenant');
const User = require('../../../entity/User');
const Setting = require('../../../entity/Setting');
const Authorizations = require('../../../authorization/Authorizations');
const TenantSecurity = require('./security/TenantSecurity');
const HttpStatusCodes = require('http-status-codes');
const TenantValidator = require('../validation/TenantValidation');
const AbstractService = require('./AbstractService');
const NotificationHandler = require('../../../notification/NotificationHandler');
const Utils = require('../../../utils/Utils');

const MODULE_NAME = 'TenantService';

class TenantService extends AbstractService {
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
          `The Tenant's ID must be provided`, 500,
          MODULE_NAME, 'handleDeleteTenant', req.user);
      }
      // Get
      const tenant = await Tenant.getTenant(filteredRequest.ID);
      // Found?
      if (!tenant) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Tenant with ID '${filteredRequest.ID}' does not exist`, 550,
          MODULE_NAME, 'handleDeleteTenant', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteTenant(req.user, tenant.getModel())) {
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
          `Your own tenant with id '${tenant.getID()}' cannot be deleted`, 550,
          MODULE_NAME, 'handleDeleteTenant', req.user);
      }
      // Delete
      await tenant.delete();
      if (filteredRequest.forced && !Utils.isServerInProductionMode()) {
        Logging.logWarning({
          tenantID: req.user.tenantID,
          module: 'MongoDBStorage', method: 'deleteTenantDatabase',
          message: `Deleting collections for tenant ${tenant.getID()}`
        });
        tenant.deleteEnvironment();
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
          `The Tenant's ID must be provided`, 500,
          MODULE_NAME, 'handleGetTenant', req.user);
      }
      // Get it
      const tenant = await Tenant.getTenant(filteredRequest.ID);
      if (!tenant) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Tenant with ID '${filteredRequest.ID}' does not exist`, 550,
          MODULE_NAME, 'handleGetTenant', req.user);
      }
      // Check auth
      if (!Authorizations.canReadTenant(req.user, tenant.getModel())) {
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
      tenants.result = tenants.result.map((tenant) => tenant.getModel());
      // Filter
      TenantSecurity.filterTenantsResponse(tenants, req.user);
      // Return
      res.json(tenants);
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleGetTenants');
    }
  }

  static async handleCreateTenant(action, req, res, next) {
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
      TenantValidator.validateTenantCreation(req.body);
      // Filter
      const filteredRequest = TenantSecurity.filterTenantCreateRequest(req.body, req.user);

      let foundTenant = await Tenant.getTenantByName(filteredRequest.name);
      if (foundTenant) {
        throw new ConflictError(`The tenant with name '${filteredRequest.name}' already exists`, 'tenants.name_already_used',
          {
            'name': filteredRequest.name
          },
          MODULE_NAME, 'handleCreateTenant', req.user, action);
      }

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
      const newTenant = await tenant.save();

      newTenant.createEnvironment();

      const password = User.generatePassword();
      const verificationToken = Utils.generateToken(newTenant.getEmail());
      // Extract the name, first name from email
      const userFirstNameAndName = newTenant.getEmail().split('@')[0].split('.');
      const userFirstName = (userFirstNameAndName.length > 0 && userFirstNameAndName[0].length > 0) ?
        userFirstNameAndName[0].charAt(0).toUpperCase() + userFirstNameAndName[0].slice(1) : "Admin"; 
      const userName = (userFirstNameAndName.length > 1 && userFirstNameAndName[1].length > 0) ?
        userFirstNameAndName[1].toUpperCase() : "NEW"; 
      const tenantUser = new User(newTenant.getID(), {
        name: userName,
        firstName: userFirstName,
        password: await User.hashPasswordBcrypt(password),
        status: Constants.USER_STATUS_PENDING,
        role: Constants.ROLE_ADMIN,
        email: newTenant.getEmail(),
        tagIDs: [Utils.generateTagID(userName, userFirstName)],
        createdOn: new Date().toISOString(),
        verificationToken: verificationToken
      });

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
      res.status(HttpStatusCodes.OK).json(Object.assign({id: newTenant.getID()}, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      AbstractService._handleError(error, req, next, action, MODULE_NAME, 'handleCreateTenant');
    }
  }

  static async handleUpdateTenant(action, req, res, next) {
    try {
      // Filter
      TenantValidator.validateTenantUpdate(req.body);
      const filteredRequest = TenantSecurity.filterTenantUpdateRequest(req.body, req.user);

      // Check email
      const tenant = await Tenant.getTenant(filteredRequest.id);
      if (!tenant) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Tenant with ID '${filteredRequest.ID}' does not exist`, 550,
          MODULE_NAME, 'handleUpdateTenant', req.user);
      }
      // Check auth
      if (!Authorizations.canUpdateTenant(req.user, tenant.getModel())) {
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
      const updatedTenant = await tenant.save();
      // Create settings
      for (const activeComponent of tenant.getActiveComponents()) {
        // Get the settings
        const currentSetting = await Setting.getSettingByIdentifier(tenant.getID(), activeComponent.name);
        // Create
        const newSettingContent = Setting.createDefaultSettingContent(
          activeComponent, (currentSetting ? currentSetting.getContent() : null));
        if (newSettingContent) {
          // Create & Save
          if (!currentSetting) {
            const newSetting = new Setting(tenant.getID(), {
              identifier: activeComponent.name,
              content: newSettingContent
            });
            newSetting.setCreatedOn(new Date());
            // Save Setting
            await newSetting.save();
          } else {
            currentSetting.setContent(newSettingContent);
            currentSetting.setLastChangedOn(new Date());
            // Save Setting
            await currentSetting.save();
          }
        }
      }
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
}

module.exports = TenantService;
