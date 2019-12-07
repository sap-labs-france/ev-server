import fs from 'fs';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import global from './../../types/GlobalType';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';

export default class UpdateChargingStationTemplatesTask extends MigrationTask {
  async migrate() {
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
        source: 'UpdateChargingStationTemplatesTask', action: 'Migration',
        module: 'UpdateChargingStationTemplatesTask', method: 'migrate',
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
