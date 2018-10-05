const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const ObjectID = require('mongodb').ObjectID;
const AppError = require('../../exception/AppError');

class TenantStorage {
    static async getTenant(id) {
        // Create Aggregation
        let aggregation = [];
        // Filters
        aggregation.push({
            $match: {
                _id: Utils.convertToObjectID(id)
            }
        });
        // Add Created By / Last Changed By
        Utils.pushCreatedLastChangedInAggregation(aggregation);
        // Read DB
        let tenantsMDB = await global.db.collection('tenants')
            .aggregate(aggregation)
            .limit(1)
            .toArray();
        let tenantMDB = null;
        // Check
        if (tenantsMDB && tenantsMDB.length > 0) {
            // Create
            tenantMDB = tenantsMDB[0];
        }
        return tenantMDB;
    }

    static async getTenantByName(name) {
        let filter = {
            'name': name
        };
        return await TenantStorage.getTenantByFilter(filter);
    }

    static async getTenantBySubdomain(subdomain) {
        let filter = {
            'subdomain': subdomain
        };
        return await TenantStorage.getTenantByFilter(filter);
    }

    static async getTenantByFilter(filter) {
        // Read DB
        let tenantsMDB = await global.db.collection('tenants')
            .find(filter)
            .limit(1)
            .toArray();
        let tenantMDB = null;
        if (tenantsMDB && tenantsMDB.length > 0) {
            tenantMDB = tenantsMDB[0];
        }
        return tenantMDB;
    }

    static async saveTenant(tenantToSave) {
        if (!tenantToSave.id && !tenantToSave.name) {
            throw new AppError(
                Constants.CENTRAL_SERVER,
                `Tenant has no ID and no Name`,
                550, "TenantStorage", "saveTenant");
        }
        let tenantFilter = {};
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
        let tenant = {};
        Database.updateTenant(tenantToSave, tenant, false);
        // Modify
        let result = await global.db.collection('tenants').findOneAndUpdate(
            tenantFilter, {
                $set: tenant
            }, {
                upsert: true,
                new: true,
                returnOriginal: false
            });
        // Create
        return result.value;
    }

    // Delegate
    static async getTenants(params = {}, limit, skip, sort) {
        limit = Utils.checkRecordLimit(limit);
        skip = Utils.checkRecordSkip(skip);
        // Set the filters
        let filters = {};
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
        let aggregation = [];
        // Filters
        if (filters) {
            aggregation.push({
                $match: filters
            });
        }
        // Count Records
        let tenantsCountMDB = await global.db.collection('tenants')
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
        let tenantsMDB = await global.db.collection('tenants')
            .aggregate(aggregation, {
                collation: {
                    locale: Constants.DEFAULT_LOCALE,
                    strength: 2
                }
            })
            .toArray();
        // Ok
        return {
            count: (tenantsCountMDB.length > 0 ? tenantsCountMDB[0].count : 0),
            result: tenantsMDB
        };
    }

    static async deleteTenant(id) {
        await global.db.collection('tenants')
            .findOneAndDelete({
                '_id': Utils.convertToObjectID(id)
            });
    }
}

module.exports = TenantStorage;