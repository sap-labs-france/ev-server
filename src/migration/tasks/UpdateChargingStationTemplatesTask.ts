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
      // Update current Charging Station with Template
      await this.updateChargingStationsWithTemplate(tenant);
      // Remove unused props
      await this.removeChargingStationUnusedProps(tenant);
    }
  }

  private async updateChargingStationsWithTemplate(tenant: Tenant) {
    let updated = 0;
    // Get Charging Stations
    const chargingStationsMDB: ChargingStation[] = await global.database.getCollection<any>(tenant.id, 'chargingstations').find(
      { 'currentType2': { $exists: false } }).toArray();
    // Update
    for (const chargingStationMDB of chargingStationsMDB) {
      // Enrich
      const chargingStationUpdated = await OCPPUtils.enrichCharingStationWithTemplate(tenant.id, chargingStationMDB);
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
        module: 'UpdateChargingStationTemplatesTask', method: 'updateChargingStationsWithTemplate',
        message: `${updated} Charging Stations' have been updated with Template in Tenant '${tenant.name}'`
      });
    }
  }

  private async removeChargingStationUnusedProps(tenant: Tenant) {
    const result = await global.database.getCollection<any>(tenant.id, 'chargingstations').updateMany(
      { 'inactive': { $exists: true } },
      {
        $unset: {
          'numberOfConnectedPhase': '',
          'inactive': ''
        }
      },
      { upsert: false }
    );
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: 'UpdateChargingStationTemplatesTask',
        module: 'UpdateChargingStationTemplatesTask', method: 'removeChargingStationUnusedProps',
        message: `${result.modifiedCount} Charging Stations' unused properties have been removed in Tenant '${tenant.name}'`
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
    return '1.0';
  }

  getName() {
    return 'UpdateChargingStationTemplatesTask';
  }
}
