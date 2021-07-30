import { CarConnectorConnectionType, CarConnectorSetting } from '../../types/Setting';

import CarConnectorIntegration from './carConnectorIntegration';
import Logging from '../../utils/Logging';
import MercedesCarConnectorIntegration from './mercedes-connector/mercedesCarConnectorIntegration';
import { ServerAction } from '../../types/Server';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'CarConnectorFactory';

export default class CarConnectorFactory {
  static async getCarConnectorImpl(tenant: Tenant, connectorId: string): Promise<CarConnectorIntegration<CarConnectorSetting>> {
    // Check if car connector component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.CAR_CONNECTOR)) {
      const settings = await SettingStorage.getCarConnectorSettings(tenant.id);
      if (settings?.carConnector?.connections) {
        // Find connection
        const foundConnection = settings.carConnector.connections.find((connection) => connection.type === connectorId);
        if (foundConnection) {
          let carConnectorIntegrationImpl: CarConnectorIntegration<CarConnectorSetting> = null;
          switch (foundConnection.type) {
            case CarConnectorConnectionType.MERCEDES:
              carConnectorIntegrationImpl = new MercedesCarConnectorIntegration(tenant, settings.carConnector, foundConnection);
              break;
          }
          return carConnectorIntegrationImpl;
        }
      }
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.CAR_CONNECTOR,
        module: MODULE_NAME, method: 'getCarConnectorImpl',
        message: 'Car connector settings are not configured'
      });
    }
    return null;
  }
}
