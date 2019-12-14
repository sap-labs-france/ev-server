import fs from 'fs';
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
    // Update current Chargers
    try {
      // Read File
      const chargingStationTemplates =
        JSON.parse(fs.readFileSync(`${global.appRoot}/assets/templates/charging-stations.json`, 'utf8'));
      // Update Templates
      for (const chargingStationTemplate of chargingStationTemplates) {
        try {
          // Save
          await ChargingStationStorage.saveChargingStationTemplate(chargingStationTemplate);
        } catch (error) {
          Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT, 'UpdateChargingStationTemplatesTask', error);
        }
      }
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        action: 'UpdateChargingStationTemplatesTask',
        module: 'UpdateChargingStationTemplatesTask', method: 'updateChargingStationTemplate',
        message: `Tenant ${Constants.DEFAULT_TENANT}: ${chargingStationTemplates.length} Charging Station templates have been updated`
      });
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
