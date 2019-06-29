import tzlookup from 'tz-lookup';
import TSGlobal from '../../types/GlobalType';
import MigrationTask from '../MigrationTask';
import Tenant from '../../entity/Tenant';

declare const global: TSGlobal;

export default class TransactionsAddTimezoneTask extends MigrationTask {
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
    /* pragma const chargingStationTimezones:any = {};
    // Read all  Charging Stations
    const chargingStationsMDB = await global.database.getCollection<any>(tenant.getID(), 'chargingstations')
      .aggregate([]).toArray();
    // Compute timezone
    for (const chargingStationMDB of chargingStationsMDB) {
      // GPS provided?
      if (chargingStationMDB.latitude && chargingStationMDB.longitude) {
        // Compute
        chargingStationTimezones[chargingStationMDB._id] = tzlookup(
          chargingStationMDB.latitude, chargingStationMDB.longitude);
      }
    }
    // Build Mapping
    // Read all transactions
    const transactionsMDB = await global.database.getCollection<any>(tenant.getID(), 'transactions')
      .aggregate([])
      .toArray();
    // Process each transaction
    for (const transactionMDB of transactionsMDB) {
      // Set the timezone
      let timezone = chargingStationTimezones[transactionsMDB.chargeBoxID];
      if (!timezone) {
        timezone = "Europe/Paris";
      }
      // Save it
      await global.database.getCollection<any>(tenant.getID(), 'transactions').findOneAndReplace(
        { "_id": transactionMDB._id },
        { $set: { timezone }},
        { upsert: true, new: true, returnOriginal: false });
    }*/
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'TransactionsAddTimezoneTask';
  }
}

