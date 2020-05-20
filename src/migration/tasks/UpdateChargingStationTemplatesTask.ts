import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { OCPPConfigurationStatus } from '../../types/ocpp/OCPPClient';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';
import global from './../../types/GlobalType';

const MODULE_NAME = 'UpdateChargingStationTemplatesTask';

export default class UpdateChargingStationTemplatesTask extends MigrationTask {
  isAsynchronous() {
    return true;
  }

  getName() {
    return 'UpdateChargingStationTemplatesTask';
  }

  async migrate() {
    // Update Template
    await this.updateChargingStationTemplate();
    // Avoid migrating the current charging stations due to Schneider charge@home Wallboxes
    // Update Charging Stations
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      // Update Charging Station OCPP Params
      await this.updateChargingStationsOCPPParametersInTemplate(tenant);
      // Update current Charging Station with Template
      await this.updateChargingStationsParametersWithTemplate(tenant);
      // Remove unused props
      await this.removeChargingStationUnusedPropsInDB(tenant);
    }
  }

  getVersion() {
    return '1.894';
  }

  private async updateChargingStationsOCPPParametersInTemplate(tenant: Tenant) {
    // Get the charging stations
    const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {
      issuer: true
    }, Constants.DB_PARAMS_MAX_LIMIT);
    let updated = 0;
    let error = 0;
    for (const chargingStation of chargingStations.result) {
      if (chargingStation.inactive) {
        error++;
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: chargingStation.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'updateChargingStationsOCPPParametersInTemplate',
          message: `Charging Station is inactive and its OCPP Parameters cannot be updated in Tenant '${tenant.name}'`
        });
        continue;
      }
      try {
        // Get the config and Force update of OCPP params with template
        const result = await OCPPUtils.requestAndSaveChargingStationOcppParameters(tenant.id, chargingStation, true);
        if (result.status === OCPPConfigurationStatus.ACCEPTED) {
          updated++;
          Logging.logDebug({
            tenantID: Constants.DEFAULT_TENANT,
            source: chargingStation.id,
            action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
            module: MODULE_NAME, method: 'updateChargingStationsOCPPParametersInTemplate',
            message: `Charging Station OCPP Parameters have been updated with Template in Tenant '${tenant.name}'`
          });
        } else {
          error++;
          Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            source: chargingStation.id,
            action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
            module: MODULE_NAME, method: 'updateChargingStationsOCPPParametersInTemplate',
            message: `Charging Station OCPP Parameters failed to be updated with Template ('${result.status}') in Tenant '${tenant.name}'`
          });
        }
      } catch (err) {
        error++;
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: chargingStation.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          module: MODULE_NAME, method: 'updateChargingStationsOCPPParametersInTemplate',
          message: `Charging Station OCPP Parameters failed to be updated with Template in Tenant '${tenant.name}'`,
          detailedMessages: { error: err.message, stack: err.stack }
        });
      }
    }
    if (updated > 0) {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'updateChargingStationsOCPPParametersInTemplate',
        message: `${updated} Charging Station(s) have been updated with Template in Tenant '${tenant.name}'`
      });
    }
    if (error > 0) {
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'updateChargingStationsOCPPParametersInTemplate',
        message: `${error} Charging Station(s) have failed to be updated with Template in Tenant '${tenant.name}'`
      });
    }
  }

  private async updateChargingStationsParametersWithTemplate(tenant: Tenant) {
    let updated = 0;
    // Get the charging stations
    const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {
      issuer: true
    }, Constants.DB_PARAMS_MAX_LIMIT);
    // Update
    for (const chargingStation of chargingStations.result) {
      // Enrich
      let chargingStationUpdated = await OCPPUtils.enrichChargingStationWithTemplate(tenant.id, chargingStation);
      // Check Connectors
      for (const connector of chargingStation.connectors) {
        if (!Utils.objectHasProperty(connector, 'amperageLimit')) {
          connector.amperageLimit = connector.amperage;
          chargingStationUpdated = true;
        }
      }
      // Save
      if (chargingStationUpdated) {
        await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
        updated++;
      }
    }
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'updateChargingStationsWithTemplate',
        message: `${updated} Charging Stations have been updated with Template in Tenant '${tenant.name}'`
      });
    }
  }

  private async removeChargingStationUnusedPropsInDB(tenant: Tenant) {
    const result = await global.database.getCollection<any>(tenant.id, 'chargingstations').updateMany(
      { 'ocppAdvancedCommands': { $exists: true } },
      {
        $unset: {
          'numberOfConnectedPhase': '',
          'inactive': '',
          'cannotChargeInParallel': '',
          'currentType': '',
          'ocppAdvancedCommands': '',
        }
      },
      { upsert: false }
    );
    if (result.modifiedCount > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'removeChargingStationUnusedPropsInDB',
        message: `${result.modifiedCount} Charging Stations unused properties have been removed in Tenant '${tenant.name}'`
      });
    }
  }

  private async updateChargingStationTemplate() {
    // Update current Chargers
    ChargingStationStorage.updateChargingStationTemplatesFromFile().catch(
      (error) => {
        Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT, ServerAction.UPDATE_CHARGING_STATION_TEMPLATES, error);
      });
  }
}
