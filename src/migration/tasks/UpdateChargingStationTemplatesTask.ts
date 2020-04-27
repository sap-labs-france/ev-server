import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import ChargingStation from '../../types/ChargingStation';
import { ServerAction } from '../../types/Server';
import { OCPPConfigurationStatus } from '../../types/ocpp/OCPPClient';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import MigrationTask from '../MigrationTask';
import global from './../../types/GlobalType';

const MODULE_NAME = 'UpdateChargingStationTemplatesTask';

export default class UpdateChargingStationTemplatesTask extends MigrationTask {
  getVersion() {
    return '1.7';
  }

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

  private async updateChargingStationsOCPPParametersInTemplate(tenant: Tenant) {
    // Get the charging station
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
    // Get Charging Stations
    const chargingStationsMDB: ChargingStation[] = await global.database.getCollection<any>(
      tenant.id, 'chargingstations').find({
      issuer: true
    }).toArray();
    // Update
    for (const chargingStationMDB of chargingStationsMDB) {
      // Enrich
      let chargingStationUpdated = await OCPPUtils.enrichChargingStationWithTemplate(tenant.id, chargingStationMDB);
      // Check Connectors
      for (const connector of chargingStationMDB.connectors) {
        if (!Utils.objectHasProperty(connector, 'amperageLimit')) {
          connector.amperageLimit = connector.amperage;
          chargingStationUpdated = true;
        }
      }
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
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'updateChargingStationsWithTemplate',
        message: `${updated} Charging Stations have been updated with Template in Tenant '${tenant.name}'`
      });
    }
  }

  private async removeChargingStationUnusedPropsInDB(tenant: Tenant) {
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
