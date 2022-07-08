import ChargingStationStorage from '../storage/mongodb/ChargingStationStorage';
import { ChargingStationTemplate } from '../types/ChargingStation';
import ChargingStationTemplateStorage from '../storage/mongodb/ChargingStationTemplateStorage';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import Utils from '../utils/Utils';
import fs from 'fs';
import global from './../types/GlobalType';

export default class ChargingStationTemplateBootstrap {
  public static async uploadChargingStationTemplatesFromFile(): Promise<void> {
    // Read File
    let chargingStationTemplates: any[];
    try {
      chargingStationTemplates = JSON.parse(
        fs.readFileSync(`${global.appRoot}/assets/charging-station-templates/charging-stations.json`, 'utf8'));
    } catch (error) {
      await Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT_ID, ServerAction.UPDATE_CHARGING_STATION_TEMPLATES, error);
      return;
    }
    // Delete all previous templates
    await ChargingStationStorage.deleteChargingStationTemplates();
    // Update Templates
    for (const chargingStationTemplate of chargingStationTemplates) {
      const { id, ...noIdTemplate } = chargingStationTemplate;
      const chargingStationTemplateToSave: ChargingStationTemplate = {
        id: '',
        template: noIdTemplate
      };
      try {
        // Set the hashes
        chargingStationTemplateToSave.template.hash = Utils.hash(JSON.stringify(chargingStationTemplateToSave));
        chargingStationTemplateToSave.template.hashTechnical = Utils.hash(JSON.stringify(chargingStationTemplateToSave.template.technical));
        chargingStationTemplateToSave.template.hashCapabilities = Utils.hash(JSON.stringify(chargingStationTemplateToSave.template.capabilities));
        chargingStationTemplateToSave.template.hashOcppStandard = Utils.hash(JSON.stringify(chargingStationTemplateToSave.template.ocppStandardParameters));
        chargingStationTemplateToSave.template.hashOcppVendor = Utils.hash(JSON.stringify(chargingStationTemplateToSave.template.ocppVendorParameters));
        // Save
        await ChargingStationTemplateStorage.saveChargingStationTemplate(chargingStationTemplateToSave);
      } catch (error) {
        error.message = `Charging Station Template ID '${chargingStationTemplate.id}' is not valid: ${error.message as string}`;
        await Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT_ID, ServerAction.UPDATE_CHARGING_STATION_TEMPLATES, error);
        Utils.isDevelopmentEnv() && Logging.logConsoleError(error.message);
      }
    }
  }
}
