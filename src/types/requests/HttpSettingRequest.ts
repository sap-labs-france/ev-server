import { AssetConnectionSetting, CarConnectorConnectionSetting } from '../Setting';

import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpSettingRequest extends HttpByIDRequest {
  ContentFilter: boolean;
}

export interface HttpSettingsRequest extends HttpDatabaseRequest {
  Identifier?: string;
  ContentFilter?: boolean;
}

export interface HttpSettingSetRequest {
  id?: string,
  identifier: string,
  sensitiveData: []
}

export interface HttpSettingOCPISetRequest extends HttpSettingSetRequest {
  content: {
    type: string,
    ocpi: {
      businessDetails: {
        logo: {
          category?: string,
          height?: number,
          thumbnail?: string,
          type?: string,
          url?: string,
          width?: number
        },
        name: string,
        website: string
      },
      cpo: {
        countryCode: string,
        partyID: string
      },
      currency: string,
      emsp: {
        countryCode: string,
        partyID: string
      },
      tariffID?: string
    }
  }
}

export interface HttpSettingOICPSetRequest extends HttpSettingSetRequest {
  content: {
    type: string,
    ocpi: {
      businessDetails: {
        logo: {
          category?: string,
          height?: number,
          thumbnail?: string,
          type?: string,
          url?: string,
          width?: number
        },
        name: string,
        website: string
      },
      cpo: {
        countryCode: string,
        partyID: string,
        key: string,
        cert: string
      },
      currency: string,
      emsp: {
        countryCode: string,
        partyID: string,
        key: string,
        cert: string
      }
    }
  }
}

export interface HttpSettingUserSetRequest extends HttpSettingSetRequest {
  content: {
    type: string,
    user: {
      autoActivateAccountAfterValidation: boolean
    }
  }
}

export interface HttpSettingSmartChargingSetRequest extends HttpSettingSetRequest {
  content: {
    type: string,
    sapSmartCharging: {
      limitBufferAC: number,
      limitBufferDC: number,
      optimizerUrl: string,
      password: string,
      stickyLimitation: boolean,
      user: string
    }
  }
}

export interface HttpSettingRefundSetRequest extends HttpSettingSetRequest {
  content: {
    type: string,
    concur: {
      apiUrl: string,
      appUrl: string,
      authenticationUrl: string,
      clientId: string,
      clientSecret: string,
      expenseTypeId: string,
      policyId: string,
      reportName: string
    }
  }
}

export interface HttpSettingPricingSetRequest extends HttpSettingSetRequest {
  content: {
    type: string,
    simple?: {
      price: number,
      currency: string
    }
    convergentCharging?: {
      url: string,
      user: string,
      password: string,
      chargeableItemName: string
    }
  }
}

export interface HttpSettingCryptoSetRequest extends HttpSettingSetRequest {
  content: {
    type: string,
    crypto: {
      key: string,
      keyProperties: {
        blockCypher: string,
        blockSize: number,
        operationMode: string
      }
    }
  }
}

export interface HttpSettingSacSetRequest extends HttpSettingSetRequest {
  content: {
    type: string,
    sac: {
      mainUrl: string,
      timezone: string
    }
  }
}

export interface HttpSettingBillingSetRequest extends HttpSettingSetRequest {
  content: {
    type: string,
    billing: {
      isTransactionBillingActivated: boolean,
      immediateBillingAllowed: boolean,
      periodicBillingAllowed: boolean,
      taxID: string
    }
  }
}

export interface HttpSettingAssetSetRequest extends HttpSettingSetRequest {
  content: {
    type: string,
    asset: {
      connections: AssetConnectionSetting[]
    }
  }
}

export interface HttpSettingCarConnectorSetRequest extends HttpSettingSetRequest {
  content: {
    type: string,
    carConnector: {
      connections: CarConnectorConnectionSetting[]
    }
  }
}
