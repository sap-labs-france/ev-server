import axios from 'axios';
import BackendError from '../../../exception/BackendError';
import { ServerAction } from '../../../types/Server';
import { AssetConnectionSetting, AssetSetting } from '../../../types/Setting';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import AssetIntegration from '../AssetIntegration';


const MODULE_NAME = 'AssetSchneiderIntegration';

export default class AssetSchneiderIntegration extends AssetIntegration<AssetSetting> {
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
    await axios.post(`${this.connection.url}/GetToken`, params,
    {
      headers: this.buildFormHeaders()
    });
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

  private buildFormHeaders(): object {
    return {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }
}
