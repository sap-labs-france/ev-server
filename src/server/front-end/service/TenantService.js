const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const UnauthorizedError = require('../../../exception/UnauthorizedError');
const BadRequestError = require('../../../exception/BadRequestError');
const ConflictError = require('../../../exception/ConflictError');
const NotFoundError = require('../../../exception/NotFoundError');
const {
    ACTION_CREATE,
    ACTION_DELETE,
    ACTION_LIST,
    ACTION_READ,
    ACTION_UPDATE,
    CENTRAL_SERVER,
    ENTITY_TENANT,
    ENTITY_TENANTS,
    REST_RESPONSE_SUCCESS
} = require('../../../utils/Constants');
const Tenant = require('../../../entity/Tenant');
const User = require('../../../entity/User');
const Authorizations = require('../../../authorization/Authorizations');
const TenantSecurity = require('./security/TenantSecurity');
const {CREATED, OK} = require('http-status-codes');
const TenantValidator = require('../validation/TenantValidation');
const AbstractService = require('./AbstractService');

const MODULE_NAME = 'TenantService';

class TenantService extends AbstractService {
    static async handleDeleteTenant(action, req, res, next){
        try {
            // Filter
            const filteredRequest = TenantSecurity.filterTenantDeleteRequest(
            req.query, req.user);
            // Check Mandatory fields
            if (!filteredRequest.ID) {
                // Not Found!
                throw new AppError(
                CENTRAL_SERVER,
                `The Tenant's ID must be provided`, 400);
            }
            // Get
            const tenant = await Tenant.getTenant(filteredRequest.ID);
            // Found?
            if (!tenant) {
                // Not Found!
                throw new NotFoundError(
                `The Tenant with ID '${filteredRequest.id}' does not exist`);
            }
            // Check auth
            if (!Authorizations.canDeleteTenant(req.user, tenant.getModel())) {
                // Not Authorized!
                throw new UnauthorizedError(
                ACTION_DELETE,
                ENTITY_TENANT,
                tenant.getID(),
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
            res.json(REST_RESPONSE_SUCCESS);
            next();
        } catch (error) {
            TenantService._handleError(error, req, next, action, MODULE_NAME, 'handleDeleteTenant');
        }
    }

    static async handleGetTenant(action, req, res, next){
        try {
            // Filter
            const filteredRequest = TenantSecurity.filterTenantRequest(req.query, req.user);
            // Charge Box is mandatory
            if (!filteredRequest.ID) {
                // Not Found!
                throw new BadRequestError([]);
            }
            // Get it
            const tenant = await Tenant.getTenant(filteredRequest.ID);
            if (!tenant) {
                throw new NotFoundError(
                `The Tenant with ID '${filteredRequest.id}' does not exist`);
            }
            // Check auth
            if (!Authorizations.canReadTenant(req.user, tenant.getModel())) {
                // Not Authorized!
                throw new UnauthorizedError(
                ACTION_READ,
                ENTITY_TENANT,
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
            TenantService._handleError(error, req, next, action, MODULE_NAME, 'handleGetTenant');
        }
    }

    static async handleGetTenants(action, req, res, next){
        try {
            // Check auth
            if (!Authorizations.canListTenants(req.user)) {
                // Not Authorized!
                throw new UnauthorizedError(
                ACTION_LIST,
                ENTITY_TENANTS,
                req.user);
            }
            // Filter
            const filteredRequest = TenantSecurity.filterTenantsRequest(req.query, req.user);
            // Get the tenants
            const tenants = await Tenant.getTenants({
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
            TenantService._handleError(error, req, next, action, MODULE_NAME, 'handleGetTenants');
        }
    }

    static async handleCreateTenant(action, req, res, next){
        try {
            // Check auth
            if (!Authorizations.canCreateTenant(req.user)) {
                // Not Authorized!
                throw new UnauthorizedError(
                ACTION_CREATE,
                ENTITY_TENANT,
                req.user);
            }
            TenantValidator.validateTenantCreation(req.body);
            // Filter
            const filteredRequest = TenantSecurity.filterTenantCreateRequest(req.body, req.user);

            let foundTenant = await Tenant.getTenantByName(filteredRequest.name);
            if (foundTenant) {
                throw new ConflictError(`The tenant with name '${filteredRequest.name}' already exists`, 'tenants.name_already_used', {
                    'name': filteredRequest.name
                },
                'TenantService', 'handleCreateTenant', req.user, action);
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
            tenant.setCreatedBy(new User(req.user.tenant, {
                'id': req.user.id
            }));
            tenant.setCreatedOn(new Date());
            // Save
            const newTenant = await tenant.save();

            await tenant.createEnvironment();

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
            res.status(CREATED).json({
                id: newTenant.getID()
            });
            next();
        } catch (error) {
            TenantService._handleError(error, req, next, action, MODULE_NAME, 'handleCreateTenant');
        }
    }

    static async handleUpdateTenant(action, req, res, next){
        try {
            // Filter
            TenantValidator.validateTenantUpdate(req.body);
            const filteredRequest = TenantSecurity.filterTenantUpdateRequest(req.body, req.user);

            // Check email
            const tenant = await Tenant.getTenant(filteredRequest.id);
            if (!tenant) {
                throw new NotFoundError(
                `The Tenant with ID '${filteredRequest.id}' does not exist`);
            }
            // Check auth
            if (!Authorizations.canUpdateTenant(req.user, tenant.getModel())) {
                // Not Authorized!
                throw new UnauthorizedError(
                ACTION_UPDATE,
                ENTITY_TENANT,
                tenant.getID(),
                req.user);
            }
            // Update
            Database.updateTenant(filteredRequest, tenant.getModel());
            // Update timestamp
            tenant.setLastChangedBy(new User(req.user.tenant, {
                'id': req.user.id
            }));
            tenant.setLastChangedOn(new Date());
            // Update Tenant
            const updatedTenant = await tenant.save();
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
            res.json(REST_RESPONSE_SUCCESS);
            next();
        } catch (error) {
            TenantService._handleError(error, req, next, action, MODULE_NAME, 'handleUpdateTenant');
        }
    }

    static async handleVerifyTenant(action, req, res, next){
        try {
            // Filter
            const filteredRequest = TenantSecurity.filterVerifyTenantRequest(req.headers);
            // Check email
            const tenant = await Tenant.getTenantBySubdomain(filteredRequest.tenant);
            if (!tenant) {
                throw new NotFoundError(
                `The Tenant with subdomain '${filteredRequest.subdomain}' does not exist`);
            }
            res.status(OK).send({});
            next();
        } catch (error) {
            TenantService._handleError(error, req, next, action, MODULE_NAME, 'handleVerifyTenant');
        }
    }
}

module.exports = TenantService;
