import { AssetConnectionSetting, AssetSetting } from '../../../types/Setting';

import AssetIntegration from '../AssetIntegration';
import BackendError from '../../../exception/BackendError';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';
import axios from 'axios';

const MODULE_NAME = 'SchneiderAssetIntegration';

export default class SchneiderAssetIntegration extends AssetIntegration<AssetSetting> {
  public constructor(tenantID: string, settings: AssetSetting, connection: AssetConnectionSetting) {
    super(tenantID, settings, connection);
  }

  public async checkConnection() {
    // Check if connection is initialized
    this.isAssetConnectionInitialized();
    // Set credential params
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', this.connection.connection.user);
    params.append('password', Cypher.decrypt(this.connection.connection.password));
    // Send credentials to get the token
    await Utils.executePromiseWithTimeout(5000,
      axios.post(`${this.connection.url}/GetToken`, params, {
        headers: this.buildFormHeaders()
      }),
      `Time out error (5s) when trying to test the connection URL '${this.connection.url}/GetToken'`
    );
  }

  private isAssetConnectionInitialized(): void {
    if (!this.connection) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'isAssetConnectionInitialized',
        action: ServerAction.CHECK_CONNECTION,
        message: 'No connection provided'
      });
    }
  }

  private buildFormHeaders(): any {
    return {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
  }
}
