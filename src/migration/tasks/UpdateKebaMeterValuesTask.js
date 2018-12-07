const Tenant = require('../../entity/Tenant');
const DatabaseUtils = require('../../storage/mongodb/DatabaseUtils');

class UpdateKebaMeterValuesTask {
  async migrate() {
    const tenants = await Tenant.getTenants();

    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        "attribute.context": {
          $in: ['Sample.Clock']
        },
        "attribute.measurand": 'Energy.Active.Import.Register'
      }
    });
    aggregation.push({
      $lookup: {
        "from": DatabaseUtils.getCollectionName(tenant.getID(), 'chargingstations'),
        "localField": "chargeBoxID",
        "foreignField": "_id",
        "as": "chargingStation"
      }
    });
    aggregation.push({
      $unwind: {
        path: "$chargingStation",
        preserveNullAndEmptyArrays: false
      }
    });

    aggregation.push({
      $match: {
        "chargingStation.chargePointVendor": "Keba AG"
      }
    });
    const meterValuesMDB = await global.database.getCollection(tenant.getID(), 'metervalues')
      .aggregate(aggregation)
      .toArray();
    for (const meterValueMDB of meterValuesMDB) {
      await global.database.getCollection(tenant.getID(), 'metervalues').findOneAndDelete({'_id': meterValueMDB._id});
    }
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "UpdateKebaMeterValuesTask";
  }
}

module.exports = UpdateKebaMeterValuesTask;