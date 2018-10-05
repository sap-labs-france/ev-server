const Database = require('../utils/Database');
const AppError = require('../exception/AppError');
const Constants = require('../utils/Constants');
const TenantStorage = require('../storage/mongodb/TenantStorage');

class Tenant {
    constructor(tenant) {
        // Init model
        this._model = {};

        // Set it
        Database.updateTenant(tenant, this._model);
    }

    getModel() {
        return this._model;
    }

    getID() {
        return this._model.id;
    }

    setName(name) {
        this._model.name = name;
    }

    getName() {
        return this._model.name;
    }

    getCreatedBy() {
        if (this._model.createdBy) {
            return new User(this._model.createdBy);
        }
        return null;
    }

    setCreatedBy(user) {
        this._model.createdBy = user.getModel();
    }

    getCreatedOn() {
        return this._model.createdOn;
    }

    setCreatedOn(createdOn) {
        this._model.createdOn = createdOn;
    }

    getLastChangedBy() {
        if (this._model.lastChangedBy) {
            return new User(this._model.lastChangedBy);
        }
        return null;
    }

    setLastChangedBy(user) {
        this._model.lastChangedBy = user.getModel();
    }

    getLastChangedOn() {
        return this._model.lastChangedOn;
    }

    setLastChangedOn(lastChangedOn) {
        this._model.lastChangedOn = lastChangedOn;
    }

    static checkIfTenantValid(filteredRequest, req) {
        // Update model?
        if (req.method !== 'POST' && !filteredRequest.id) {
            throw new AppError(
                Constants.CENTRAL_SERVER,
                `The Tenant ID is mandatory`, 500,
                'Tenant', 'checkIfTenantValid');
        }
        if (!filteredRequest.name) {
            throw new AppError(
                Constants.CENTRAL_SERVER,
                `The Tenant Name is mandatory`, 500,
                'Tenant', 'checkIfTenantValid');
        }
        if (!filteredRequest.subdomain) {
            throw new AppError(
                Constants.CENTRAL_SERVER,
                `The Tenant Subdomain is mandatory`, 500,
                'Tenant', 'checkIfTenantValid');
        }
    }

    async save() {
        let tenantMDB = await TenantStorage.saveTenant(this.getModel());
        return new Tenant(tenantMDB);
    }

    delete() {
        return TenantStorage.deleteTenant(this.getID());
    }

    static async getTenant(id) {
        return Tenant.createTenant(await TenantStorage.getTenant(id));
    }

    static async getTenantByName(name) {
        return Tenant.createTenant(await TenantStorage.getTenantByName(name));
    }

    static async getTenantBySubdomain(subdomain) {
        return Tenant.createTenant(await TenantStorage.getTenantBySubdomain(subdomain));
    }

    static async getTenants(params = {}, limit, skip, sort) {
        let response = await TenantStorage.getTenants(params, limit, skip, sort);

        if (response.result && response.result.length > 0) {
            let tenants = [];
            for (const tenantMDB of response.result) {
                let tenant = Tenant.createTenant(tenantMDB);
                if (tenant) {
                    tenants.push(tenant);
                }
            }
            response.result = tenants;
        }
        return response;
    }

    static createTenant(tenantMDB) {
        let tenant;
        if (tenantMDB) {
            tenant = new Tenant(tenantMDB);
        }
        return tenant;
    }
}

module.exports = Tenant;
