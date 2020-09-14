import { OCPPChangeConfigurationCommandResult, OCPPConfigurationStatus } from '../../types/ocpp/OCPPClient';

import { ActionsResponse } from '../../types/GlobalType';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { OCPPPhase } from '../../types/ocpp/OCPPServer';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'CheckChargingStationTemplateTask';

export default class CheckChargingStationTemplateTask extends SchedulerTask {
  public async run(name: string, config: TaskConfig): Promise<void> {
    // Update Template
    await this.updateChargingStationTemplate();
    // Call default implementation
    await super.run(name, config);
  }

  public async processTenant(tenant: Tenant): Promise<void> {
    // Get the lock
    const offlineChargingStationLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.CHARGING_STATION, 'check-template');
    if (await LockingManager.acquire(offlineChargingStationLock)) {
      try {
        // Update
        await this.applyTemplateToChargingStations(tenant);
      } catch (error) {
        // Log error
        Logging.logActionExceptionMessage(tenant.id, ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE, error);
      } finally {
        // Release the lock
        await LockingManager.release(offlineChargingStationLock);
      }
    }
  }

  private async applyTemplateToChargingStations(tenant: Tenant) {
    let updated = 0;
    // Bypass perf tenant
    if (tenant.subdomain === 'testperf') {
      Logging.logWarning({
        tenantID: tenant.id,
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
          if (!Utils.objectHasProperty(connector, 'phaseAssignmentToGrid')) {
            const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
            if (numberOfPhases === 1) {
              connector.phaseAssignmentToGrid = { csPhaseL1: OCPPPhase.L1, csPhaseL2: null, csPhaseL3: null } ;
            } else if (numberOfPhases === 3) {
              connector.phaseAssignmentToGrid = { csPhaseL1: OCPPPhase.L1, csPhaseL2: OCPPPhase.L2, csPhaseL3: OCPPPhase.L3 } ;
            } else {
              connector.phaseAssignmentToGrid = null;
            }
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
            tenantID: tenant.id,
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
              tenantID: tenant.id,
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
                tenantID: tenant.id,
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
            Utils.logActionsResponse(
              tenant.id,
              ServerAction.MIGRATION,
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
          tenantID: tenant.id,
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
        tenantID: tenant.id,
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

