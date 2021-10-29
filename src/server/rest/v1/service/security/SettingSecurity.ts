import { AnalyticsSettingsType, AssetConnectionSetting, AssetConnectionType, AssetSettingsType, BillingSettingsType, CarConnectorConnectionSetting, CarConnectorConnectionType, CarConnectorSettingsType, OicpBusinessDetails, OicpSetting, PricingSettingsType, RoamingSettingsType, SettingDB, SettingDBContent, SettingLink, SimplePricingSetting } from '../../../../../types/Setting';
import { HttpSettingRequest, HttpSettingsRequest } from '../../../../../types/requests/HttpSettingRequest';

import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class SettingSecurity {

  public static filterSettingRequestByID(request: any): string {
    return sanitize(request.ID);
  }

  public static filterSettingRequest(request: any): HttpSettingRequest {
    return {
      ID: sanitize(request.ID),
      ContentFilter: UtilsSecurity.filterBoolean(request.ContentFilter)
    };
  }

  public static filterSettingsRequest(request: any): HttpSettingsRequest {
    const filteredRequest: HttpSettingsRequest = {} as HttpSettingsRequest;
    filteredRequest.Identifier = sanitize(request.Identifier);
    filteredRequest.ContentFilter = UtilsSecurity.filterBoolean(request.ContentFilter);
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterSettingUpdateRequest(request: any): Partial<SettingDB> {
    const filteredRequest = SettingSecurity._filterSettingRequest(request);
    filteredRequest.id = sanitize(request.id);
    return filteredRequest;
  }

  public static filterSettingCreateRequest(request: any): Partial<SettingDB> {
    return SettingSecurity._filterSettingRequest(request);
  }

  private static _filterSettingRequest(request: Partial<SettingDB>): Partial<SettingDB> {
    const settings: SettingDB = {
      identifier: sanitize(request.identifier),
      sensitiveData: request.sensitiveData ? request.sensitiveData.map(sanitize) : []
    } as SettingDB;
    // Check Content
    if (Utils.objectHasProperty(request, 'content')) {
      settings.content = {
        type: request.content.type
      } as SettingDBContent;
      // Check Links
      if (Utils.objectHasProperty(request.content, 'links')) {
        settings.content.links = request.content.links.map((link: SettingLink) => ({
          id: link.id,
          name: link.name,
          description: link.description,
          role: link.role,
          url: link.url
        }));
      }
      // Handle different config types
      switch (request.content.type) {
        case AnalyticsSettingsType.SAC:
          settings.content.sac = {
            mainUrl: sanitize(request.content.sac.mainUrl),
            timezone: sanitize(request.content.sac.timezone)
          };
          break;
        case RoamingSettingsType.OICP:
          settings.content.oicp = {} as OicpSetting;
          if (request.content.oicp.businessDetails) {
            settings.content.oicp.businessDetails = {
              name: sanitize(request.content.oicp.businessDetails.name),
              website: sanitize(request.content.oicp.businessDetails.website)
            } as OicpBusinessDetails;
            if (request.content.oicp.businessDetails.logo) {
              settings.content.oicp.businessDetails.logo = {
                url: sanitize(request.content.oicp.businessDetails.logo.url),
                thumbnail: sanitize(request.content.oicp.businessDetails.logo.thumbnail),
                category: sanitize(request.content.oicp.businessDetails.logo.category),
                type: sanitize(request.content.oicp.businessDetails.logo.type),
                width: sanitize(request.content.oicp.businessDetails.logo.width),
                height: sanitize(request.content.oicp.businessDetails.logo.height),
              };
            }
          }
          if (request.content.oicp.cpo) {
            settings.content.oicp.cpo = {
              countryCode: sanitize(request.content.oicp.cpo.countryCode),
              partyID: sanitize(request.content.oicp.cpo.partyID),
              key: sanitize(request.content.oicp.cpo.key),
              cert:sanitize(request.content.oicp.cpo.cert)
            };
          }
          if (request.content.oicp.emsp) {
            settings.content.oicp.emsp = {
              countryCode: sanitize(request.content.oicp.emsp.countryCode),
              partyID: sanitize(request.content.oicp.emsp.partyID),
              key: sanitize(request.content.oicp.emsp.key),
              cert:sanitize(request.content.oicp.emsp.cert)
            };
          }
          if (request.content.oicp.currency) {
            settings.content.oicp.currency = request.content.oicp.currency;
          }
          break;
        case PricingSettingsType.CONVERGENT_CHARGING:
          settings.content.convergentCharging = {
            url: sanitize(request.content.convergentCharging.url),
            chargeableItemName: sanitize(request.content.convergentCharging.chargeableItemName),
            user: sanitize(request.content.convergentCharging.user),
            password: sanitize(request.content.convergentCharging.password),
          };
          break;
        case BillingSettingsType.STRIPE:
          settings.content.billing = {
            isTransactionBillingActivated : sanitize(request.content.billing.isTransactionBillingActivated),
            immediateBillingAllowed: sanitize(request.content.billing.immediateBillingAllowed),
            periodicBillingAllowed: sanitize(request.content.billing.periodicBillingAllowed),
            taxID: sanitize(request.content.billing.taxID)
          };
          settings.content.stripe = {
            url: sanitize(request.content.stripe.url),
            secretKey: sanitize(request.content.stripe.secretKey),
            publicKey: sanitize(request.content.stripe.publicKey),
          };
          break;
        case AssetSettingsType.ASSET:
          settings.content.asset = {
            connections: [],
          };
          for (const connection of request.content.asset.connections) {
            const sanitizedConnection: AssetConnectionSetting = {
              id: sanitize(connection.id),
              name: sanitize(connection.name),
              description: sanitize(connection.description),
              url: sanitize(connection.url),
              type: sanitize(connection.type),
              refreshIntervalMins: sanitize(connection.refreshIntervalMins),
              timestamp: new Date(),
            };
            // Check type
            switch (connection.type) {
              case AssetConnectionType.SCHNEIDER:
                sanitizedConnection.schneiderConnection = {
                  user: sanitize(connection.schneiderConnection.user),
                  password: sanitize(connection.schneiderConnection.password),
                };
                break;
              case AssetConnectionType.GREENCOM:
                sanitizedConnection.greencomConnection = {
                  clientId: sanitize(connection.greencomConnection.clientId),
                  clientSecret: sanitize(connection.greencomConnection.clientSecret),
                };
                break;
              case AssetConnectionType.IOTHINK:
                sanitizedConnection.iothinkConnection = {
                  user: sanitize(connection.iothinkConnection.user),
                  password: sanitize(connection.iothinkConnection.password),
                };
                break;
              case AssetConnectionType.WIT:
                sanitizedConnection.witConnection = {
                  authenticationUrl: sanitize(connection.witConnection.authenticationUrl),
                  clientId: sanitize(connection.witConnection.clientId),
                  clientSecret: sanitize(connection.witConnection.clientSecret),
                  user: sanitize(connection.witConnection.user),
                  password: sanitize(connection.witConnection.password),
                };
                break;
              case AssetConnectionType.LACROIX:
                sanitizedConnection.lacroixConnection = {
                  user: sanitize(connection.lacroixConnection.user),
                  password: sanitize(connection.lacroixConnection.password),
                };
                break;
            }
            settings.content.asset.connections.push(sanitizedConnection);
          }
          break;
        case CarConnectorSettingsType.CAR_CONNECTOR:
          settings.content.carConnector = {
            connections: [],
          };
          for (const connection of request.content.carConnector.connections) {
            const sanitizedConnection: CarConnectorConnectionSetting = {
              id: sanitize(connection.id),
              name: sanitize(connection.name),
              description: sanitize(connection.description),
              type: sanitize(connection.type),
              timestamp: new Date(),
            };
            // Check type
            switch (connection.type) {
              case CarConnectorConnectionType.MERCEDES:
                sanitizedConnection.mercedesConnection = {
                  authenticationUrl: sanitize(connection.mercedesConnection.authenticationUrl),
                  apiUrl: sanitize(connection.mercedesConnection.apiUrl),
                  clientId: sanitize(connection.mercedesConnection.clientId),
                  clientSecret: sanitize(connection.mercedesConnection.clientSecret),
                };
                break;
              case CarConnectorConnectionType.TRONITY:
                sanitizedConnection.tronityConnection = {
                  apiUrl: sanitize(connection.tronityConnection.apiUrl),
                  clientId: sanitize(connection.tronityConnection.clientId),
                  clientSecret: sanitize(connection.tronityConnection.clientSecret),
                };
                break;
            }
            settings.content.carConnector.connections.push(sanitizedConnection);
          }
          break;
      }
    }
    return settings;
  }
}
