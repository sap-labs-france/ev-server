import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import ChargingStationVendorFactory from '../../integration/charging-station-vendor/ChargingStationVendorFactory';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { OCPPConfigurationStatus } from '../../types/ocpp/OCPPClient';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'UpdateChargingStationTemplatesTask';

export default class UpdateChargingStationStaticLimitationTask extends MigrationTask {
  isAsynchronous(): boolean {
    return true;
  }

  getName(): string {
    return 'UpdateChargingStationStaticLimitationTask';
  }

  async migrate(): Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    for (const tenant of tenants.result) {
      // Initialize amperage limitation
      await this.initChargingStationLimitAmps(tenant);
    }
  }

  getVersion(): string {
    return '1.0';
  }

  private async initChargingStationLimitAmps(tenant: Tenant) {
    let updated = 0;
    // Get the charging stations
    const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {
      issuer: true, includeDeleted: true
    }, Constants.DB_PARAMS_MAX_LIMIT);
    // Update
    for (const chargingStation of chargingStations.result) {
      // Check Charge Point
      if (chargingStation.chargePoints) {
        for (const chargePoint of chargingStation.chargePoints) {
          let chargePointUpdated = false;
          // Get the Vendor instance
          const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorImpl(chargingStation);
          if (chargingStationVendor) {
            // Get max charge point amps
            const amperageChargePointMax = Utils.getChargingStationAmperage(chargingStation, chargePoint);
            try {
              // Call the limitation
              const result = await chargingStationVendor.setStaticPowerLimitation(tenant.id, chargingStation,
                chargePoint, amperageChargePointMax);
              if (result.status === OCPPConfigurationStatus.ACCEPTED || result.status === OCPPConfigurationStatus.REBOOT_REQUIRED) {
                chargePointUpdated = true;
                updated++;
              } else {
                Logging.logError({
                  tenantID: tenant.id,
                  action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
                  module: MODULE_NAME, method: 'initChargingStationLimitAmps',
                  message: `Cannot set Charge Point static limitation to ${amperageChargePointMax}A`,
                  detailedMessages: { chargePoint }
                });
              }
            } catch (error) {
              Logging.logError({
                tenantID: tenant.id,
                action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
                module: MODULE_NAME, method: 'initChargingStationLimitAmps',
                message: `Cannot set Charge Point static limitation to ${amperageChargePointMax}A`,
                detailedMessages: { error: error.message, stack: error.stack, chargePoint }
              });
            }
          }
          if (!chargePointUpdated) {
            // Update each connector manually
            for (const connectorID of chargePoint.connectorIDs) {
              // Get max connector amps
              const connector = Utils.getConnectorFromID(chargingStation, connectorID);
              if (connector) {
                connector.amperageLimit = Utils.getChargingStationAmperage(chargingStation, chargePoint, connectorID);
              }
            }
            await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
            updated++;
          }
        }
      } else if (chargingStation.connectors) {
        // Update each connector manually
        for (const connector of chargingStation.connectors) {
          if (connector) {
            connector.amperageLimit = connector.amperage;
          }
        }
        await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
        updated++;
      }
    }
    if (updated > 0) {
      Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.UPDATE_CHARGING_STATION_WITH_TEMPLATE,
        module: MODULE_NAME, method: 'cleanUpChargingStationDBProps',
        message: `${updated} Charging Stations amperage limit has been updated in Tenant '${tenant.name}'`
      });
    }
  }
}
