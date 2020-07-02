import { OCPPChangeConfigurationCommandResult, OCPPConfigurationStatus } from '../../types/ocpp/OCPPClient';

import { ActionsResponse } from './../../types/GlobalType';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'UpdateChargingStationTemplatesTask';

export default class UpdateChargingStationTemplatesTask extends MigrationTask {
  isAsynchronous(): boolean {
    return true;
  }

  getName(): string {
    return 'UpdateChargingStationTemplatesTask';
  }

  async migrate(): Promise<void> {
    // Update Template
    await this.updateChargingStationTemplate();
    // Update Charging Stations
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      // Update current Charging Station with Template
      await this.applyTemplateToChargingStations(tenant);
    }
  }

  getVersion(): string {
    return '3.07';
  }

  private async applyTemplateToChargingStations(tenant: Tenant) {
    let updated = 0;
    // Bypass perf tenant
    if (tenant.subdomain === 'testperf') {
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
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
          const sectionsUpdated = [];
          if (chargingStationTemplateUpdated.technicalUpdated) {
            sectionsUpdated.push('Technical');
          }
          if (chargingStationTemplateUpdated.ocppUpdated) {
            sectionsUpdated.push('OCPP');
          }
          if (chargingStationTemplateUpdated.capabilitiesUpdated) {
            sectionsUpdated.push('Capabilities');
          }
          Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            source: chargingStation.id,
            action: ServerAction.MIGRATION,
            module: MODULE_NAME, method: 'enrichChargingStationWithTemplate',
            message: `Charging Station '${chargingStation.id}' updated with the following Template's section(s): ${sectionsUpdated.join(', ')}`,
            detailedMessages: { chargingStationTemplateUpdated }
          });
          // Save
          await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
          updated++;
          // Retrieve OCPP params and update them if needed
          if (chargingStationTemplateUpdated.ocppUpdated) {
            Logging.logDebug({
              tenantID: Constants.DEFAULT_TENANT,
              action: ServerAction.MIGRATION,
              source: chargingStation.id,
              module: MODULE_NAME, method: 'applyTemplateToChargingStations',
              message: `Apply Template's OCPP Parameters for '${chargingStation.id}' in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
            });
            // Request the latest configuration
            const result = await Utils.executePromiseWithTimeout<OCPPChangeConfigurationCommandResult>(
              60 * 1000, OCPPUtils.requestAndSaveChargingStationOcppParameters(tenant.id, chargingStation),
              'Time out error (60s) in requesting OCPP params');
            if (result.status !== OCPPConfigurationStatus.ACCEPTED) {
              Logging.logError({
                tenantID: Constants.DEFAULT_TENANT,
                action: ServerAction.MIGRATION,
                source: chargingStation.id,
                module: MODULE_NAME, method: 'applyTemplateToChargingStations',
                message: `Cannot request OCPP Parameters from '${chargingStation.id}' in Tenant '${tenant.name}' ('${tenant.subdomain}')`,
              });
              continue;
            }
            // Update the OCPP parameters from the template
            const updatedOcppParameters = await Utils.executePromiseWithTimeout<ActionsResponse>(
              60 * 1000, OCPPUtils.updateChargingStationTemplateOcppParameters(tenant.id, chargingStation),
              'Time out error (60s) in updating OCPP Parameters');
            // Log
            Utils.logActionsResponse(Constants.DEFAULT_TENANT, ServerAction.MIGRATION,
              MODULE_NAME, 'applyTemplateToChargingStations', updatedOcppParameters,
              `{{inSuccess}} OCPP Parameter(s) were successfully synchronized, check details in the Tenant '${tenant.name}' ('${tenant.subdomain}')`,
              `{{inError}} OCPP Parameter(s) failed to be synchronized, check details in the Tenant '${tenant.name}' ('${tenant.subdomain}')`,
              `{{inSuccess}} OCPP Parameter(s) were successfully synchronized and {{inError}} failed to be synchronized, check details in the Tenant '${tenant.name}' ('${tenant.subdomain}')`,
              'All the OCPP Parameters are up to date'
            );
          }
        }
      } catch (error) {
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.MIGRATION,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'applyTemplateToChargingStations',
          message: `Template update error in Tenant '${tenant.name}' ('${tenant.subdomain}'): ${error.message}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    if (updated > 0) {
      Logging.logDebug({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.MIGRATION,
        module: MODULE_NAME, method: 'applyTemplateToChargingStations',
        message: `${updated} Charging Stations have been processed with Template in Tenant '${tenant.name}' ('${tenant.subdomain}')`
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
