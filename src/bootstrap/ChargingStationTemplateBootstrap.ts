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
    let chargingStationTemplates: ChargingStationTemplate[];
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
      try {
        // Set the hashes
        chargingStationTemplate.hash = Utils.hash(JSON.stringify(chargingStationTemplate));
        chargingStationTemplate.hashTechnical = Utils.hash(JSON.stringify(chargingStationTemplate.technical));
        chargingStationTemplate.hashCapabilities = Utils.hash(JSON.stringify(chargingStationTemplate.capabilities));
        chargingStationTemplate.hashOcppStandard = Utils.hash(JSON.stringify(chargingStationTemplate.ocppStandardParameters));
        chargingStationTemplate.hashOcppVendor = Utils.hash(JSON.stringify(chargingStationTemplate.ocppVendorParameters));
        // Save
        await ChargingStationTemplateStorage.saveChargingStationTemplate(chargingStationTemplate);
      } catch (error) {
        error.message = `Charging Station Template ID '${chargingStationTemplate.id}' is not valid: ${error.message as string}`;
        await Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT_ID, ServerAction.UPDATE_CHARGING_STATION_TEMPLATES, error);
        Utils.isDevelopmentEnv() && Logging.logConsoleError(error.message);
      }
    }
  }
}
