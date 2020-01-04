import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import ChargingStation from '../../types/ChargingStation';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import global from './../../types/GlobalType';

export default class UpdateChargingStationTemplatesTask extends MigrationTask {
  async migrate() {
    // Update Template
    await this.updateChargingStationTemplate();
    // Update Charging Stations
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      await this.updateChargingStations(tenant);
    }
  }

  private async updateChargingStations(tenant: Tenant) {
    let updated = 0;
    // Get Charging Stations
    const chargingStationsMDB: ChargingStation[] = await global.database.getCollection<any>(tenant.id, 'chargingstations').find(
      { 'capabilities': { $exists: false } }).toArray();
    // Update
    for (const chargingStationMDB of chargingStationsMDB) {
      // Enrich
      const chargingStationUpdated = await OCPPUtils.enrichCharingStationWithTemplate(chargingStationMDB);
      // Save
      if (chargingStationUpdated) {
        await global.database.getCollection(tenant.id, 'chargingstations').findOneAndUpdate(
          { '_id': chargingStationMDB['_id'] },
          { $set: chargingStationMDB },
          { upsert: true, returnOriginal: false }
        );
        updated++;
      }
    }
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: 'UpdateChargingStationTemplatesTask',
        module: 'UpdateChargingStationTemplatesTask', method: 'updateChargingStations',
        message: `${updated} Charging Stations' capabilities have been updated in Tenant '${tenant.name}'`
      });
    }
  }

  private async updateChargingStationTemplate() {
    try {
      // Update current Chargers
      ChargingStationStorage.updateChargingStationTemplatesFromFile();
    } catch (error) {
      Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT, 'UpdateChargingStationTemplatesTask', error);
    }
  }

  getVersion() {
    return '1.12';
  }

  getName() {
    return 'UpdateChargingStationTemplatesTask';
  }
}
