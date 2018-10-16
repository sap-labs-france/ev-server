import Logging from '../../../utils/Logging';
import Database from '../../../utils/Database';
import AppError from '../../../exception/AppError';
import AppAuthError from '../../../exception/AppAuthError';
import BadRequestError from '../../../exception/BadRequestError';
import ConflictError from '../../../exception/ConflictError';
import NotFoundError from '../../../exception/NotFoundError';
import {
    CENTRAL_SERVER,
    ACTION_DELETE,
    ENTITY_TENANT,
    REST_RESPONSE_SUCCESS,
    ACTION_READ,
    ACTION_LIST,
    ENTITY_TENANTS,
    ACTION_CREATE,
    ACTION_UPDATE
} from '../../../utils/Constants';
import Tenant from '../../../model/Tenant';
import User from '../../../model/User';
import Authorizations from '../../../authorization/Authorizations';
import TenantSecurity from './security/TenantSecurity';
import {
    OK,
    CREATED
} from 'http-status-codes';
import TenantValidator from '../validation/TenantValidation';

export async function handleDeleteTenant(action, req, res, next) {
    try {
        // Filter
        let filteredRequest = TenantSecurity.filterTenantDeleteRequest(
            req.query, req.user);
        // Check Mandatory fields
        if (!filteredRequest.ID) {
            // Not Found!
            throw new AppError(
                CENTRAL_SERVER,
                `The Tenant's ID must be provided`, 400);
        }
        // Get
        let tenant = await Tenant.getTenant(filteredRequest.ID);
        // Found?
        if (!tenant) {
            // Not Found!
            throw new NotFoundError(
                `The Tenant with ID '${filteredRequest.id}' does not exist`);
        }
        // Check auth
        if (!Authorizations.canDeleteTenant(req.user, tenant.getModel())) {
            // Not Authorized!
            throw new AppAuthError(
                ACTION_DELETE,
                ENTITY_TENANT,
                tenant.getID(),
                user = req.user);
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
        _handleError(error, req, next, action, 'handleDeleteTenant');
    }
}

export async function handleGetTenant(action, req, res, next) {
    try {
        // Filter
        let filteredRequest = TenantSecurity.filterTenantRequest(req.query, req.user);
        // Charge Box is mandatory
        if (!filteredRequest.ID) {
            // Not Found!
            throw new BadRequestError([]);
        }
        // Get it
        let tenant = await Tenant.getTenant(filteredRequest.ID);
        if (!tenant) {
            throw new NotFoundError(
                `The Tenant with ID '${filteredRequest.id}' does not exist`);
        }
        // Check auth
        if (!Authorizations.canReadTenant(req.user, tenant.getModel())) {
            // Not Authorized!
            throw new AppAuthError(
                ACTION_READ,
                ENTITY_TENANT,
                user = req.user);
        }
        // Return
        res.json(
            // Filter
            TenantSecurity.filterTenantResponse(
                tenant.getModel(), req.user)
        );
        next();
    } catch (error) {
        _handleError(error, req, next, action, 'handleGetTenant');
    }
}

export async function handleGetTenants(action, req, res, next) {
    try {
        // Check auth
        if (!Authorizations.canListTenants(req.user)) {
            // Not Authorized!
            throw new AppAuthError(
                ACTION_LIST,
                ENTITY_TENANTS,
                user = req.user);
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
        _handleError(error, req, next, action, 'handleGetTenants');
    }
}

export async function handleCreateTenant(action, req, res, next) {
    try {
        // Check auth
        if (!Authorizations.canCreateTenant(req.user)) {
            // Not Authorized!
            throw new AppAuthError(
                ACTION_CREATE,
                ENTITY_TENANT,
                user = req.user);
        }
        TenantValidator.validateTenantCreation(req.body);
        // Filter
        let filteredRequest = TenantSecurity.filterTenantCreateRequest(req.body, req.user);

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
        let tenant = new Tenant(filteredRequest);
        // Update timestamp
        tenant.setCreatedBy(new User({
            'id': req.user.id
        }));
        tenant.setCreatedOn(new Date());
        // Save
        let newTenant = await tenant.save();

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
        _handleError(error, req, next, action, 'handleCreateTenant');
    }
}

export async function handleUpdateTenant(action, req, res, next) {
    try {
        // Filter
        TenantValidator.validateTenantUpdate(req.body);
        let filteredRequest = TenantSecurity.filterTenantUpdateRequest(req.body, req.user);

        // Check email
        let tenant = await Tenant.getTenant(filteredRequest.id);
        if (!tenant) {
            throw new NotFoundError(
                `The Tenant with ID '${filteredRequest.id}' does not exist`);
        }
        // Check auth
        if (!Authorizations.canUpdateTenant(req.user, tenant.getModel())) {
            // Not Authorized!
            throw new AppAuthError(
                ACTION_UPDATE,
                ENTITY_TENANT,
                tenant.getID(),
                user = req.user);
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
        res.json(REST_RESPONSE_SUCCESS);
        next();
    } catch (error) {
        _handleError(error, req, next, action, 'handleUpdateTenant');
    }
}

export async function handleVerifyTenant(action, req, res, next) {
    try {
        // Filter
        let filteredRequest = TenantSecurity.filterVerifyTenantRequest(req.headers);
        // Check email
        let tenant = await Tenant.getTenantBySubdomain(filteredRequest.tenant);
        if (!tenant) {
            throw new NotFoundError(
                `The Tenant with subdomain '${filteredRequest.subdomain}' does not exist`);
        }
        res.status(OK).send({});
        next();
    } catch (error) {
        _handleError(error, req, next, action, 'handleVerifyTenant');
    }
}

function _handleError(error, req, next, action, method) {
    Logging.logException(error, action, CENTRAL_SERVER, 'TenantService', method, req.user);
    next(error);
}