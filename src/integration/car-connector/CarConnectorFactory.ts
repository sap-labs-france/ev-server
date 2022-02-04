import { CarConnectorConnectionType, CarConnectorSettings } from '../../types/Setting';
import Tenant, { TenantComponents } from '../../types/Tenant';

import CarConnectorIntegration from './CarConnectorIntegration';
import MercedesCarConnectorIntegration from './mercedes-connector/MercedesCarConnectorIntegration';
import SettingStorage from '../../storage/mongodb/SettingStorage';
import TronityCarConnectorIntegration from './tronity-connector/TronityCarConnectorIntegration';
import Utils from '../../utils/Utils';

export default class CarConnectorFactory {
  public static async getCarConnectorImpl(tenant: Tenant, carConnectorId: string): Promise<CarConnectorIntegration<CarConnectorSettings>> {
    // Check if car connector component is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.CAR_CONNECTOR)) {
      const settings = await SettingStorage.getCarConnectorSettings(tenant);
      if (settings?.carConnector?.connections) {
        // Find connection by id
        const foundConnection = settings.carConnector.connections.find((connection) => connection.id === carConnectorId);
        if (foundConnection) {
          let carConnectorIntegrationImpl: CarConnectorIntegration<CarConnectorSettings> = null;
          switch (foundConnection.type) {
            case CarConnectorConnectionType.MERCEDES:
              carConnectorIntegrationImpl = new MercedesCarConnectorIntegration(tenant, settings, foundConnection);
              break;
            case CarConnectorConnectionType.TRONITY:
              carConnectorIntegrationImpl = new TronityCarConnectorIntegration(tenant, settings, foundConnection);
              break;
          }
          return carConnectorIntegrationImpl;
        }
      }
    }
    return null;
  }
}
