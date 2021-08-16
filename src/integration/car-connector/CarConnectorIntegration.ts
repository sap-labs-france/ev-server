import { CarConnectorConnectionSetting, CarConnectorSetting } from '../../types/Setting';

import Connection from '../../types/Connection';
import Tenant from '../../types/Tenant';

export default abstract class CarConnectorIntegration<T extends CarConnectorSetting> {
  protected readonly tenant: Tenant;
  protected settings: T;
  protected connection: CarConnectorConnectionSetting;

  protected constructor(tenant: Tenant, settings: T, connection: CarConnectorConnectionSetting) {
    this.tenant = tenant;
    this.settings = settings;
    this.connection = connection;
  }

  public abstract createConnection(userID: string, data: unknown): Promise<Connection>;

  public abstract getCurrentSoC(userID: string): Promise<number>;
}
