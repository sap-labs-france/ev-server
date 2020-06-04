import global from './../../types/GlobalType';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import { TemplateUpdateResult } from '../../types/ChargingStation';
import { OCPPChangeConfigurationCommandResult } from '../../types/ocpp/OCPPClient';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import MigrationTask from '../MigrationTask';

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
      // Update current Charging Station with Template
      await this.applyTemplateToChargingStations(tenant);
      // Remove unused props
      // await this.cleanUpChargingStationDBProps(tenant);
    }
  }

  getVersion() {
    return '2.3';
  }

  private async applyTemplateToChargingStations(tenant: Tenant) {
    let updated = 0;
    // Bypass perf tenant
    if (tenant.subdomain === 'testperf') {
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'applyTemplateToChargingStations',
        message: `Bypassed tenant '${tenant.name}' ('${tenant.subdomain}')`
      });
      return;
    }
    // Get the charging stations
    const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {
      issuer: true
    }, Constants.DB_PARAMS_MAX_LIMIT);
    // Update
    for (const chargingStation of chargingStations.result) {
      try {
        Logging.logDebug({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'applyTemplateToChargingStations',
          message: `Check template for '${chargingStation.id}' in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
        });
        const chargingStationTemplateUpdated =
          await OCPPUtils.enrichChargingStationWithTemplate(tenant.id, chargingStation);
        // Enrich
        let chargingStationUpdated = false;
        // Check Connectors
        for (const connector of chargingStation.connectors) {
          if (!Utils.objectHasProperty(connector, 'amperageLimit')) {
            connector.amperageLimit = connector.amperage;
            chargingStationUpdated = true;
          }
        }
        // Save
        if (chargingStationTemplateUpdated.technicalUpdated ||
            chargingStationTemplateUpdated.capabilitiesUpdated ||
            chargingStationTemplateUpdated.ocppUpdated ||
            chargingStationUpdated) {
          await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
          updated++;
          // Retrieve OCPP params and update them if needed
          if (chargingStationTemplateUpdated.ocppUpdated) {
            Logging.logDebug({
              tenantID: Constants.DEFAULT_TENANT,
              action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
              source: chargingStation.id,
              module: MODULE_NAME, method: 'applyTemplateToChargingStations',
              message: `Apply new OCPP Parameters for '${chargingStation.id}' in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
            });
            await Utils.promiseWithTimeout<OCPPChangeConfigurationCommandResult>(
              60 * 1000, OCPPUtils.requestAndSaveChargingStationOcppParameters(
                tenant.id, chargingStation, chargingStationTemplateUpdated.ocppUpdated),
              'Time out error with updating OCPP params');
          }
        }
      } catch (error) {
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'applyTemplateToChargingStations',
          message: `Template update error in Tenant '${tenant.name}': ${error.message}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'applyTemplateToChargingStations',
        message: `${updated} Charging Stations have been updated with Template in Tenant '${tenant.name}'`
      });
    }
  }

  private async cleanUpChargingStationDBProps(tenant: Tenant) {
    const result = await global.database.getCollection<any>(tenant.id, 'chargingstations').updateMany(
      { },
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
        module: MODULE_NAME, method: 'cleanUpChargingStationDBProps',
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
