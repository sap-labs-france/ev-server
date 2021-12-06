import { AssetConnectionToken } from '../../types/Asset';
import Tenant from '../../types/Tenant';
import moment from 'moment';

export default class AssetTokenCache {
  private static instances = new Map<string, AssetTokenCache>();
  private tokens = new Map<string, AssetConnectionToken>();

  public static getInstanceForTenant(tenant: Tenant): AssetTokenCache {
    if (!AssetTokenCache.instances.has(tenant.id)) {
      AssetTokenCache.instances.set(tenant.id, new AssetTokenCache());
    }
    return AssetTokenCache.instances.get(tenant.id);
  }

  public getToken(assetConnectionId: string): AssetConnectionToken {
    const token = this.tokens.get(assetConnectionId);
    if (token && !moment(new Date(token.expires)).subtract(60, 'seconds').isBefore()) {
      return token;
    }
    return null;
  }

  public setToken(assetConnectionId: string, token: AssetConnectionToken): void {
    this.tokens.set(assetConnectionId, token);
  }
}
