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
import { StaticLimitAmps } from '../../types/ChargingStation';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'CheckChargingStationTemplateTask';

export default class CheckChargingStationTemplateTask extends SchedulerTask {
  public async run(name: string, config: TaskConfig): Promise<void> {
    // Update Template
    this.updateChargingStationTemplates();
    // Call default implementation
    await super.run(name, config);
  }

  public async processTenant(tenant: Tenant): Promise<void> {
    // Get the lock
    const checkChargingStationTemplatesLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.CHARGING_STATION, 'check-templates');
    if (await LockingManager.acquire(checkChargingStationTemplatesLock)) {
      try {
        // Update
        await this.applyTemplateToChargingStations(tenant);
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE, error);
      } finally {
        // Release the lock
        await LockingManager.release(checkChargingStationTemplatesLock);
      }
    }
  }

  private async applyTemplateToChargingStations(tenant: Tenant) {
    let updated = 0;
    // Bypass perf tenant
    if (tenant.subdomain === 'testperf') {
      await Logging.logWarning({
        tenantID: tenant.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'applyTemplateToChargingStations',
        message: `Bypassed tenant ${Utils.buildTenantName(tenant)})`
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
        const chargingStationTemplateUpdated = await OCPPUtils.enrichChargingStationWithTemplate(tenant.id, chargingStation);
        // Enrich
        let chargingStationUpdated = false;
        // Check Connectors
        for (const connector of chargingStation.connectors) {
          // Amperage limit
          const connectorAmperageLimitMax = Utils.getChargingStationAmperage(chargingStation, null, connector.connectorId);
          const numberOfPhases = Utils.getNumberOfConnectedPhases(chargingStation, null, connector.connectorId);
          const numberOfConnectors = chargingStation.connectors.length;
          const connectorAmperageLimitMin = StaticLimitAmps.MIN_LIMIT_PER_PHASE * numberOfPhases * numberOfConnectors;
          if (!Utils.objectHasProperty(connector, 'amperageLimit') || (Utils.objectHasProperty(connector, 'amperageLimit') && Utils.isNullOrUndefined(connector.amperageLimit))) {
            connector.amperageLimit = connectorAmperageLimitMax;
            chargingStationUpdated = true;
          } else if (Utils.objectHasProperty(connector, 'amperageLimit') && connector.amperageLimit > connectorAmperageLimitMax) {
            connector.amperageLimit = connectorAmperageLimitMax;
            chargingStationUpdated = true;
          } else if (Utils.objectHasProperty(connector, 'amperageLimit') && connector.amperageLimit < connectorAmperageLimitMin) {
            connector.amperageLimit = connectorAmperageLimitMin;
            chargingStationUpdated = true;
          }
          // Phase Assignment
          if (!Utils.objectHasProperty(connector, 'phaseAssignmentToGrid')) {
            // Phase Assignment to Grid has to be handled only for Site Area with 3 phases
            if (chargingStation?.siteArea?.numberOfPhases === 3) {
              // Single Phase
              if (numberOfPhases === 1) {
                connector.phaseAssignmentToGrid = { csPhaseL1: OCPPPhase.L1, csPhaseL2: null, csPhaseL3: null };
              // Tri-phase
              } else if (numberOfPhases === 3) {
                connector.phaseAssignmentToGrid = { csPhaseL1: OCPPPhase.L1, csPhaseL2: OCPPPhase.L2, csPhaseL3: OCPPPhase.L3 };
              }
            } else {
              connector.phaseAssignmentToGrid = null;
            }
            chargingStationUpdated = true;
          }
        }
        // Save
        if (chargingStationTemplateUpdated.technicalUpdated ||
            chargingStationTemplateUpdated.capabilitiesUpdated ||
            chargingStationTemplateUpdated.ocppStandardUpdated ||
            chargingStationTemplateUpdated.ocppVendorUpdated ||
            chargingStationUpdated) {
          const sectionsUpdated = [];
          if (chargingStationTemplateUpdated.technicalUpdated) {
            sectionsUpdated.push('Technical');
          }
          if (chargingStationTemplateUpdated.capabilitiesUpdated) {
            sectionsUpdated.push('Capabilities');
          }
          if (chargingStationTemplateUpdated.ocppStandardUpdated || chargingStationTemplateUpdated.ocppVendorUpdated) {
            sectionsUpdated.push('OCPP');
          }
          await Logging.logInfo({
            tenantID: tenant.id,
            source: chargingStation.id,
            action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
            module: MODULE_NAME, method: 'applyTemplateToChargingStations',
            message: `Charging Station '${chargingStation.id}' updated with the following Template's section(s): ${sectionsUpdated.join(', ')}`,
            detailedMessages: { chargingStationUpdated, chargingStationTemplateUpdated }
          });
          // Save
          await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
          updated++;
          // Retrieve OCPP parameters and update them if needed
          if (chargingStationTemplateUpdated.ocppStandardUpdated || chargingStationTemplateUpdated.ocppVendorUpdated) {
            await Logging.logDebug({
              tenantID: tenant.id,
              action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
              source: chargingStation.id,
              module: MODULE_NAME, method: 'applyTemplateToChargingStations',
              message: `Apply Template's OCPP Parameters for '${chargingStation.id}' in Tenant ${Utils.buildTenantName(tenant)})`,
            });
            // Request the latest configuration
            const result = await Utils.executePromiseWithTimeout<OCPPChangeConfigurationCommandResult>(
              Constants.DELAY_REQUEST_CONFIGURATION_EXECUTION_MILLIS, OCPPUtils.requestAndSaveChargingStationOcppParameters(tenant.id, chargingStation),
              `Time out error (${Constants.DELAY_REQUEST_CONFIGURATION_EXECUTION_MILLIS}ms) in requesting OCPP Parameters`);
            if (result.status !== OCPPConfigurationStatus.ACCEPTED) {
              await Logging.logError({
                tenantID: tenant.id,
                action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
                source: chargingStation.id,
                module: MODULE_NAME, method: 'applyTemplateToChargingStations',
                message: `Cannot request OCPP Parameters from '${chargingStation.id}' in Tenant ${Utils.buildTenantName(tenant)})`,
              });
              continue;
            }
            // Update the OCPP Parameters from the template
            const updatedOcppParameters = await Utils.executePromiseWithTimeout<ActionsResponse>(
              Constants.DELAY_REQUEST_CONFIGURATION_EXECUTION_MILLIS, OCPPUtils.updateChargingStationTemplateOcppParameters(tenant.id, chargingStation),
              `Time out error (${Constants.DELAY_REQUEST_CONFIGURATION_EXECUTION_MILLIS}ms) in updating OCPP Parameters`);
            // Log
            await Logging.logActionsResponse(
              tenant.id,
              ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
              MODULE_NAME, 'applyTemplateToChargingStations', updatedOcppParameters,
              `{{inSuccess}} OCPP Parameter(s) were successfully synchronized, check details in the Tenant ${Utils.buildTenantName(tenant)})`,
              `{{inError}} OCPP Parameter(s) failed to be synchronized, check details in the Tenant ${Utils.buildTenantName(tenant)})`,
              `{{inSuccess}} OCPP Parameter(s) were successfully synchronized and {{inError}} failed to be synchronized, check details in the Tenant ${Utils.buildTenantName(tenant)})`,
              'All the OCPP Parameters are up to date'
            );
          }
        }
      } catch (error) {
        await Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
          source: chargingStation.id,
          module: MODULE_NAME, method: 'applyTemplateToChargingStations',
          message: `Template update error in Tenant ${Utils.buildTenantName(tenant)}): ${error.message}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    if (updated > 0) {
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'applyTemplateToChargingStations',
        message: `${updated} Charging Stations have been processed with Template in Tenant ${Utils.buildTenantName(tenant)})`
      });
    }
  }

  private updateChargingStationTemplates() {
    // Update current Chargers
    ChargingStationStorage.updateChargingStationTemplatesFromFile().catch(
      (error) => {
        void Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT, ServerAction.UPDATE_CHARGING_STATION_TEMPLATES, error);
      });
  }
}

