import { AssetConnectionTokenSetting, AssetConnectionType } from '../types/Setting';

import Tenant from '../types/Tenant';
import moment from 'moment';

export default class AssetTokenCache {
  private static instances = new Map<string, AssetTokenCache>();
  private tokens = new Map<AssetConnectionType, AssetConnectionTokenSetting>();

  public static getInstanceForTenant(tenant: Tenant): AssetTokenCache {
    if (!AssetTokenCache.instances.has(tenant.id)) {
      AssetTokenCache.instances.set(tenant.id, new AssetTokenCache());
    }
    return AssetTokenCache.instances.get(tenant.id);
  }

  public getToken(assetConnectionType: AssetConnectionType): AssetConnectionTokenSetting {
    const token = this.tokens.get(assetConnectionType);
    if (token && !moment(new Date(token.expires)).subtract(60, 'seconds').isBefore()) {
      return token;
    }
    return null;
  }

  public setToken(assetConnectionType: AssetConnectionType, token: AssetConnectionTokenSetting): void {
    this.tokens.set(assetConnectionType, token);
  }
}
