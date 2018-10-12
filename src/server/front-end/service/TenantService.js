const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Constants = require('../../../utils/Constants');
const Tenant = require('../../../model/Tenant');
const User = require('../../../model/User');
const Authorizations = require('../../../authorization/Authorizations');
const TenantSecurity = require('./security/TenantSecurity');
const HttpStatus = require('http-status-codes');

class TenantService {
    static async handleDeleteTenant(action, req, res, next) {
        try {
            // Filter
            let filteredRequest = TenantSecurity.filterTenantDeleteRequest(
                req.query, req.user);
            // Check Mandatory fields
            if (!filteredRequest.ID) {
                // Not Found!
                throw new AppError(
                    Constants.CENTRAL_SERVER,
                    `The Tenant's ID must be provided`, 500,
                    'TenantService', 'handleDeleteTenant', req.user);
            }
            // Get
            let tenant = await Tenant.getTenant(filteredRequest.ID);
            // Found?
            if (!tenant) {
                // Not Found!
                throw new AppError(
                    Constants.CENTRAL_SERVER,
                    `Tenant with ID '${filteredRequest.ID}' does not exist`, 550,
                    'TenantService', 'handleDeleteTenant', req.user);
            }
            // Check auth
            if (!Authorizations.canDeleteTenant(req.user, tenant.getModel())) {
                // Not Authorized!
                throw new AppAuthError(
                    Constants.ACTION_DELETE,
                    Constants.ENTITY_TENANT,
                    tenant.getID(),
                    560, 'TenantService', 'handleDeleteTenant',
                    req.user);
            }
            // Delete
            await tenant.delete();
            // Log
            Logging.logSecurityInfo({
                user: req.user,
                module: 'TenantService',
                method: 'handleDeleteTenant',
                message: `Tenant '${tenant.getName()}' has been deleted successfully`,
                action: action,
                detailedMessages: tenant
            });
            // Ok
            res.json(Constants.REST_RESPONSE_SUCCESS);
            next();
        } catch (error) {
            // Log
            Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
        }
    }

    static async handleGetTenant(action, req, res, next) {
        try {
            // Filter
            let filteredRequest = TenantSecurity.filterTenantRequest(req.query, req.user);
            // Charge Box is mandatory
            if (!filteredRequest.ID) {
                // Not Found!
                throw new AppError(
                    Constants.CENTRAL_SERVER,
                    `The Tenant's ID must be provided`, 500,
                    'TenantService', 'handleGetTenant', req.user);
            }
            // Get it
            let tenant = await Tenant.getTenant(filteredRequest.ID);
            if (!tenant) {
                throw new AppError(
                    Constants.CENTRAL_SERVER,
                    `The Tenant with ID '${filteredRequest.ID}' does not exist anymore`, 550,
                    'TenantService', 'handleGetTenant', req.user);
            }
            // Check auth
            if (!Authorizations.canReadTenant(req.user, tenant.getModel())) {
                // Not Authorized!
                throw new AppAuthError(
                    Constants.ACTION_READ,
                    Constants.ENTITY_TENANT,
                    tenant.getID(),
                    560, 'TenantService', 'handleGetTenant',
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
            // Log
            Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
        }
    }

    static async handleGetTenants(action, req, res, next) {
        try {
            // Check auth
            if (!Authorizations.canListTenants(req.user)) {
                // Not Authorized!
                throw new AppAuthError(
                    Constants.ACTION_LIST,
                    Constants.ENTITY_TENANTS,
                    null,
                    560, 'TenantService', 'handleGetTenants',
                    req.user);
                return;
            }
            // Filter
            let filteredRequest = TenantSecurity.filterTenantsRequest(req.query, req.user);
            // Get the tenants
            let tenants = await Tenant.getTenants({
                    search: filteredRequest.Search
                },
                filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
            // Set
            tenants.result = tenants.result.map((tenant) => tenant.getModel());
            // Filter
            tenants.result = TenantSecurity.filterTenantsResponse(
                tenants.result, req.user);
            // Return
            res.json(tenants);
            next();
        } catch (error) {
            // Log
            Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
        }
    }

    static async handleCreateTenant(action, req, res, next) {
        try {
            // Check auth
            if (!Authorizations.canCreateTenant(req.user)) {
                // Not Authorized!
                throw new AppAuthError(
                    Constants.ACTION_CREATE,
                    Constants.ENTITY_TENANT,
                    null,
                    560, 'TenantService', 'handleCreateTenant',
                    req.user);
            }
            // Filter
            let filteredRequest = TenantSecurity.filterTenantCreateRequest(req.body, req.user);
            // Check Mandatory fields
            Tenant.checkIfTenantValid(filteredRequest, req);

            let foundTenant = await Tenant.getTenantByName(filteredRequest.name);
            if (foundTenant) {
                throw new AppError(
                    Constants.CENTRAL_SERVER,
                    `The tenant with name '${filteredRequest.name}' already exists`, 510,
                    'TenantService', 'handleCreateTenant', req.user);
            }

            foundTenant = await Tenant.getTenantBySubdomain(filteredRequest.subdomain);
            if (foundTenant) {
                throw new AppError(
                    Constants.CENTRAL_SERVER,
                    `The tenant with subdomain '${filteredRequest.subdomain}' already exists`, 510,
                    'TenantService', 'handleCreateTenant', req.user);
            }

            // Create
            let tenant = new Tenant(filteredRequest);
            // Update timestamp
            tenant.setCreatedBy(new User({
                'id': req.user.id
            }));
            tenant.setCreatedOn(new Date());
            // Save
            let newTenant = await tenant.save();
            // Log
            Logging.logSecurityInfo({
                user: req.user,
                module: 'TenantService',
                method: 'handleCreateTenant',
                message: `Tenant '${newTenant.getName()}' has been created successfully`,
                action: action,
                detailedMessages: newTenant
            });
            // Ok
          const result = Constants.REST_RESPONSE_SUCCESS;
          result.id = newTenant._model.id;
          res.json(result);
            next();
        } catch (error) {
            // Log
            Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
        }
    }

    static async handleUpdateTenant(action, req, res, next) {
        try {
            // Filter
            let filteredRequest = TenantSecurity.filterTenantUpdateRequest(req.body, req.user);
            // Check email
            let tenant = await Tenant.getTenant(filteredRequest.id);
            if (!tenant) {
                throw new AppError(
                    Constants.CENTRAL_SERVER,
                    `The Tenant with ID '${filteredRequest.id}' does not exist anymore`, 550,
                    'TenantService', 'handleUpdateTenant', req.user);
            }
            // Check Mandatory fields
            Tenant.checkIfTenantValid(filteredRequest, req);
            // Check auth
            if (!Authorizations.canUpdateTenant(req.user, tenant.getModel())) {
                // Not Authorized!
                throw new AppAuthError(
                    Constants.ACTION_UPDATE,
                    Constants.ENTITY_TENANT,
                    tenant.getID(),
                    560, 'TenantService', 'handleCreateTenant',
                    req.user);
            }
            // Update
            Database.updateTenant(filteredRequest, tenant.getModel());
            // Update timestamp
            tenant.setLastChangedBy(new User({
                'id': req.user.id
            }));
            tenant.setLastChangedOn(new Date());
            // Update Tenant
            let updatedTenant = await tenant.save();
            // Log
            Logging.logSecurityInfo({
                user: req.user,
                module: 'TenantService',
                method: 'handleUpdateTenant',
                message: `Tenant '${updatedTenant.getName()}' has been updated successfully`,
                action: action,
                detailedMessages: updatedTenant
            });
            // Ok
            res.json(Constants.REST_RESPONSE_SUCCESS);
            next();
        } catch (error) {
            // Log
            Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
        }
    }

    static async handleVerifyTenant(action, req, res, next) {
        try {
            // Filter
            let filteredRequest = TenantSecurity.filterVerifyTenantRequest(req.headers);
            // Check email
            let tenant = await Tenant.getTenantBySubdomain(filteredRequest.tenant);
            if (!tenant) {
                throw new AppError(
                    Constants.CENTRAL_SERVER,
                    `The Tenant with subdomain '${filteredRequest.subdomain}' does not exist anymore`, HttpStatus.NOT_FOUND,
                    'TenantService', 'handleVerifyTenant');
            }
            res.status(HttpStatus.OK).send({});
            next();
        } catch (error) {
            Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
        }
    }
}

module.exports = TenantService;