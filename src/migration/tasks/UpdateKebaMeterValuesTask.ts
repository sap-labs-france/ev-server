import Tenant from '../../entity/Tenant';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import MigrationTask from '../MigrationTask';
import TSGlobal from '../../types/GlobalType';
declare var global: TSGlobal;

export default class UpdateKebaMeterValuesTask extends MigrationTask {
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

