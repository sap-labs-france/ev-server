const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const ObjectID = require('mongodb').ObjectID;
const AppError = require('../../exception/AppError');

class TenantStorage {
    static async getTenant(id){
        const Tenant = require('../../model/Tenant'); // Avoid fucking circular deps!!!
        // Create Aggregation
        const aggregation = [];
        // Filters
        aggregation.push({
            $match: {
                _id: Utils.convertToObjectID(id)
            }
        });
        // Add Created By / Last Changed By
        Utils.pushCreatedLastChangedInAggregation(aggregation);
        // Read DB
        const tenantsMDB = await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants')
        .aggregate(aggregation)
        .limit(1)
        .toArray();
        let tenant = null;
        // Found?
        if (tenantsMDB && tenantsMDB.length > 0) {
            // Create
            tenant = new Tenant(tenantsMDB[0]);
        }
        return tenant;
    }

    static async getTenantByName(name){
        // Get
        return await TenantStorage.getTenantByFilter({'name': name});
    }

    static async getTenantBySubdomain(subdomain){
        // Get
        return await TenantStorage.getTenantByFilter({'subdomain': subdomain});
    }

    static async getTenantByFilter(filter){
        const Tenant = require('../../model/Tenant'); // Avoid fucking circular deps!!!
        // Read DB
        const tenantsMDB = await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants')
        .find(filter)
        .limit(1)
        .toArray();
        let tenant = null;
        // Found?
        if (tenantsMDB && tenantsMDB.length > 0) {
            // Create
            tenant = new Tenant(tenantsMDB[0]);
        }
        return tenant;
    }

    static async saveTenant(tenantToSave){
        const Tenant = require('../../model/Tenant'); // Avoid fucking circular deps!!!
        // Check
        if (!tenantToSave.id && !tenantToSave.name) {
            throw new AppError(
            Constants.CENTRAL_SERVER,
            `Tenant has no ID and no Name`,
            550, "TenantStorage", "saveTenant");
        }
        const tenantFilter = {};
        // Build Request
        if (tenantToSave.id) {
            tenantFilter._id = Utils.convertToObjectID(tenantToSave.id);
        } else {
            tenantFilter._id = new ObjectID();
        }
        // Check Created By/On
        tenantToSave.createdBy = Utils.convertUserToObjectID(tenantToSave.createdBy);
        tenantToSave.lastChangedBy = Utils.convertUserToObjectID(tenantToSave.lastChangedBy);
        // Transfer
        const tenant = {};
        Database.updateTenant(tenantToSave, tenant, false);
        // Modify
        const result = await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants').findOneAndUpdate(
        tenantFilter, {
            $set: tenant
        }, {
            upsert: true,
            new: true,
            returnOriginal: false
        });
        // Create
        return new Tenant(result.value);
    }

    static async createTenantDB(tenant){
        await global.database.createTenantDatabase(tenant);
    }

    // Delegate
    static async getTenants(params = {}, limit, skip, sort){
        const Tenant = require('../../model/Tenant'); // Avoid fucking circular deps!!!
        // Check Limit
        limit = Utils.checkRecordLimit(limit);
        // Check Skip
        skip = Utils.checkRecordSkip(skip);
        // Set the filters
        const filters = {};
        // Source?
        if (params.search) {
            // Build filter
            filters.$or = [{
                "name": {
                    $regex: params.search,
                    $options: 'i'
                }
            }];
        }
        // Create Aggregation
        const aggregation = [];
        // Filters
        if (filters) {
            aggregation.push({
                $match: filters
            });
        }
        // Count Records
        const tenantsCountMDB = await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants')
        .aggregate([...aggregation, {
            $count: "count"
        }])
        .toArray();
        // Add Created By / Last Changed By
        Utils.pushCreatedLastChangedInAggregation(aggregation);
        // Sort
        if (sort) {
            // Sort
            aggregation.push({
                $sort: sort
            });
        } else {
            // Default
            aggregation.push({
                $sort: {
                    name: 1
                }
            });
        }
        // Skip
        aggregation.push({
            $skip: skip
        });
        // Limit
        aggregation.push({
            $limit: limit
        });
        // Read DB
        const tenantsMDB = await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants')
        .aggregate(aggregation, {
            collation: {
                locale: Constants.DEFAULT_LOCALE,
                strength: 2
            }
        })
        .toArray();

        const tenants = [];
        // Create
        for (const tenantMDB of tenantsMDB) {
            // Add
            tenants.push(new Tenant(tenantMDB));
        }
        // Ok
        return {
            count: (tenantsCountMDB.length > 0 ? tenantsCountMDB[0].count : 0),
            result: tenants
        };
    }

    static async deleteTenant(id){
        await global.database.getCollection(Constants.DEFAULT_TENANT, 'tenants')
        .findOneAndDelete({
            '_id': Utils.convertToObjectID(id)
        });
    }
}

module.exports = TenantStorage;