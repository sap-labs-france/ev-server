import moment from 'moment';
import { deprecate } from 'util';
import ChargingStation from '../../entity/ChargingStation';
import Database from '../../utils/Database';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import TSGlobal from '../../types/GlobalType';
import MigrationTask from '../MigrationTask';
import Tenant from '../../entity/Tenant';
import Transaction from '../../entity/Transaction';
declare const global: TSGlobal;

export default class UpdateTransactionInactivityTask extends MigrationTask {
  async migrate() {
    const tenants = await Tenant.getTenants();

    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  /**
   * @deprecated
   * @param tenant
   */
  async migrateTenant(tenant) {
    /* // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        "stop": {
          $exists: true
        }
      }
    });
    // Add Charger
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenant.getID(), 'chargingstations'),
        localField: 'chargeBoxID',
        foreignField: '_id',
        as: 'chargeBox'
      }
    });
    // Single Record
    aggregation.push({
      $unwind: {
        "path": "$chargeBox",
        "preserveNullAndEmptyArrays": true
      }
    });
    // Sort
    aggregation.push({
      $sort: {timestamp: -1}
    });
    // Read DB
    const transactionsMDB = await global.database.getCollection<any>(tenant.getID(), 'transactions')
      .aggregate(aggregation)
      .toArray();
    // Process each transaction
    for (const transactionMDB of transactionsMDB) {
      const transaction:any = {};
      // Update
      Database.updateTransaction(transactionMDB, transaction, false);
      // Set the Transaction ID
      Database.updateID(transactionMDB, transaction);
      // Get the Charging Station
      const chargingStation = new ChargingStation(tenant.getID, transactionMDB.chargeBox);
      // Get Consumption
      const trans = await Transaction.getTransaction(tenant.getID(), transaction.id);
      const consumption = trans.getConsumption();//chargingStation.getConsumptionsFromTransaction(transaction);
      // Set the total consumption
      transaction.stop.totalConsumption = consumption.totalConsumption;
      // Compute total inactivity seconds
      transaction.stop.totalInactivitySecs = 0;
      for (let index = 0; index < consumption.values.length; index++) {
        const value = consumption.values[index];
        // Don't check the first
        if (index > 0) {
          // Check value + Check Previous value
          if (value.value == 0 && consumption.values[index - 1].value === 0) {
            // Add the inactivity in secs
            transaction.stop.totalInactivitySecs += moment.duration(
              moment(value.date).diff(moment(consumption.values[index - 1].date))
            ).asSeconds();
          }
        }
      }
      // Delete Transactions
      await global.database.getCollection<any>(tenant.getID(), 'transactions').findOneAndDelete({'_id': transaction.getID()});
      // Remove Id
      delete transaction.id;
      // Save it
      await global.database.getCollection<any>(tenant.getID(), 'transactions').findOneAndUpdate({
        "_id": transactionMDB._id
      }, {
        $set: transaction
      }, {
        upsert: true,
        returnOriginal: false
      });
    }*/
  }

  getVersion() {
    return '3.1';
  }

  getName() {
    return 'TransactionInactivityTask';
  }
}

