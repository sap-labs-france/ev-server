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
  id: string,
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
