import { CarConnectorConnectionSetting, CarConnectorConnectionToken, CarConnectorSettings } from '../../types/Setting';

import { Car } from '../../types/Car';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

export default abstract class CarConnectorIntegration<T extends CarConnectorSettings> {
  protected readonly tenant: Tenant;
  protected settings: T;
  protected connection: CarConnectorConnectionSetting;

  protected constructor(tenant: Tenant, settings: T, connection: CarConnectorConnectionSetting) {
    this.tenant = tenant;
    this.settings = settings;
    this.connection = connection;
  }

  public checkIfTokenExpired(token: CarConnectorConnectionToken): boolean {
    if (!Utils.isNullOrUndefined(token)) {
      const expireTime = new Date(token.expires).getTime() - 60000; // 1 minute buffer
      return expireTime <= new Date().getTime();
    }
    return true;
  }

  public abstract getCurrentSoC(car: Car, userID?: string): Promise<number>;
}
