const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const UtilsSecurity = require('./UtilsSecurity');

class TenantSecurity {

    static filterTenantDeleteRequest(request, loggedUser) {
        let filteredRequest = {};
        // Set
        filteredRequest.ID = sanitize(request.ID);
        return filteredRequest;
    }

    static filterTenantRequest(request, loggedUser) {
        let filteredRequest = {};
        filteredRequest.ID = sanitize(request.ID);
        return filteredRequest;
    }

    static filterVerifyTenantRequest(request) {
        let filteredRequest = {};
        filteredRequest.tenant = sanitize(request.tenant);
        return filteredRequest;
    }

    static filterTenantsRequest(request, loggedUser) {
        let filteredRequest = {};
        filteredRequest.Search = sanitize(request.Search);
        UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
        UtilsSecurity.filterSort(request, filteredRequest);
        return filteredRequest;
    }

    static filterTenantUpdateRequest(request, loggedUser) {
        let filteredRequest = TenantSecurity._filterTenantRequest(request, loggedUser);
        filteredRequest.id = sanitize(request.id);
        return filteredRequest;
    }

    static filterTenantCreateRequest(request, loggedUser) {
        return TenantSecurity._filterTenantRequest(request, loggedUser);
    }

    static _filterTenantRequest(request, loggedUser) {
        let filteredRequest = {};
        filteredRequest.name = sanitize(request.name);
        filteredRequest.subdomain = sanitize(request.subdomain);
        return filteredRequest;
    }

    static filterTenantResponse(tenant, loggedUser) {
        let filteredTenant;

        if (!tenant) {
            return null;
        }
        // Check auth
        if (Authorizations.canReadTenant(loggedUser, tenant)) {
            // Admin?
            if (Authorizations.isSuperAdmin(loggedUser)) {
                // Yes: set all params
                filteredTenant = tenant;
            } else {
                // Set only necessary info
                filteredTenant = {};
                filteredTenant.id = tenant.id;
                filteredTenant.name = tenant.name;
                filteredTenant.subdomain = tenant.subdomain;
            }
            // Created By / Last Changed By
            UtilsSecurity.filterCreatedAndLastChanged(
                filteredTenant, tenant, loggedUser);
        }
        return filteredTenant;
    }

    static filterTenantsResponse(tenants, loggedUser) {
        let filteredTenants = [];

        if (!tenants) {
            return null;
        }
        if (!Authorizations.canListTenants(loggedUser)) {
            return null;
        }
        for (const tenant of tenants) {
            // Filter
            let filteredTenant = TenantSecurity.filterTenantResponse(tenant, loggedUser);
            // Ok?
            if (filteredTenant) {
                // Add
                filteredTenants.push(filteredTenant);
            }
        }
        return filteredTenants;
    }
}

module.exports = TenantSecurity;
