import sanitize from 'mongo-sanitize';
import Authorizations from '../../../../authorization/Authorizations';
import { HttpSettingRequest, HttpSettingsRequest } from '../../../../types/requests/HttpSettingRequest';
import { AnalyticsSettingsType, BillingSettingsType, ConcurRefundSetting, OcpiBusinessDetails, OcpiSetting, PricingSettingsType, RefundSettingsType, RoamingSettingsType, SettingDB, SettingDBContent, SettingLink, SimplePricingSetting, SmartChargingSettingsType } from '../../../../types/Setting';
import UserToken from '../../../../types/UserToken';
import Constants from '../../../../utils/Constants';
import Utils from '../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';

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

  public static _filterSettingRequest(request: Partial<SettingDB>): Partial<SettingDB> {
    const settings: SettingDB = {
      identifier: sanitize(request.identifier),
      sensitiveData: request.sensitiveData ? request.sensitiveData.map(sanitize) : []
    } as SettingDB;
    // Check Content
    if (request.content) {
      settings.content = {
        type: request.content.type
      } as SettingDBContent;
      // Check Links
      if (request.content.links) {
        settings.content.links = request.content.links.map((link: SettingLink) => {
          return {
            id: link.id,
            name: link.name,
            description: link.description,
            role: link.role,
            url: link.url
          }
        });
      }
      // Handle different config types
      switch (request.content.type) {
        case AnalyticsSettingsType.SAC:
          settings.content.sac = {
            mainUrl: sanitize(request.content.sac.mainUrl),
            timezone: sanitize(request.content.sac.timezone)
          };
          break;
        case RoamingSettingsType.GIREVE:
          settings.content.ocpi = {} as OcpiSetting;
          if (request.content.ocpi.businessDetails) {
            settings.content.ocpi.businessDetails = {
              name: sanitize(request.content.ocpi.businessDetails.name),
              website: sanitize(request.content.ocpi.businessDetails.website)
            } as OcpiBusinessDetails;
            if (request.content.ocpi.businessDetails.logo) {
              settings.content.ocpi.businessDetails.logo = {
                url: sanitize(request.content.ocpi.businessDetails.logo.url),
                thumbnail: sanitize(request.content.ocpi.businessDetails.logo.thumbnail),
                category: sanitize(request.content.ocpi.businessDetails.logo.category),
                type: sanitize(request.content.ocpi.businessDetails.logo.type),
                width: sanitize(request.content.ocpi.businessDetails.logo.width),
                height: sanitize(request.content.ocpi.businessDetails.logo.height),
              };
            }
          }
          if (request.content.ocpi.cpo) {
            settings.content.ocpi.cpo = {
              countryCode: sanitize(request.content.ocpi.cpo.countryCode),
              partyID: sanitize(request.content.ocpi.cpo.partyID)
            }
          }
          if (request.content.ocpi.emsp) {
            settings.content.ocpi.emsp = {
              countryCode: sanitize(request.content.ocpi.emsp.countryCode),
              partyID: sanitize(request.content.ocpi.emsp.partyID)
            }
          }
          break;
        case RefundSettingsType.CONCUR:
          if (!Utils.isEmptyJSon(request.content.concur)) {
            settings.content.concur = {
              authenticationUrl: sanitize(request.content.concur.authenticationUrl),
              apiUrl: sanitize(request.content.concur.apiUrl),
              appUrl: sanitize(request.content.concur.appUrl),
              clientId: sanitize(request.content.concur.clientId),
              clientSecret: sanitize(request.content.concur.clientSecret),
              paymentTypeId: sanitize(request.content.concur.paymentTypeId),
              expenseTypeCode: sanitize(request.content.concur.expenseTypeCode),
              policyId: sanitize(request.content.concur.policyId),
              reportName: sanitize(request.content.concur.reportName),
            }
          } else {
            settings.content.concur = { } as ConcurRefundSetting;            
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
        case PricingSettingsType.SIMPLE:
          if (!Utils.isEmptyJSon(request.content.simple)) {
            settings.content.simple = {
              price: sanitize(request.content.simple.price),
              currency: sanitize(request.content.simple.currency),
            };            
          } else {
            settings.content.simple = { } as SimplePricingSetting;            
          }
          break;
        case BillingSettingsType.STRIPE:
          settings.content.stripe = {
            url: sanitize(request.content.stripe.url),
            secretKey: sanitize(request.content.stripe.secretKey),
            publicKey: sanitize(request.content.stripe.publicKey),
            noCardAllowed: sanitize(request.content.stripe.noCardAllowed),
            immediateBillingAllowed: sanitize(request.content.stripe.immediateBillingAllowed),
            periodicBillingAllowed: sanitize(request.content.stripe.periodicBillingAllowed),
            advanceBillingAllowed: sanitize(request.content.stripe.advanceBillingAllowed),
            currency: sanitize(request.content.stripe.currency),
            taxID: sanitize(request.content.stripe.taxID),
          };
          break;
        case SmartChargingSettingsType.SAP_SMART_CHARGING:
          settings.content.sapSmartCharging = {
            optimizerUrl: sanitize(request.content.sapSmartCharging.optimizerUrl),
            user: sanitize(request.content.sapSmartCharging.user),
            password: sanitize(request.content.sapSmartCharging.password),
          };
          break;
      }
    }
    return settings;
  }

  public static filterSettingResponse(setting: SettingDB, loggedUser: UserToken, contentFilter = false) {
    let filteredSetting;
    if (!setting) {
      return null;
    }
    // Check auth
    if (Authorizations.canReadSetting(loggedUser, setting)) {
      filteredSetting = setting;
      if (contentFilter) {
        filteredSetting.content = SettingSecurity._filterAuthorizedSettingContent(loggedUser, setting);
      }
      // Created By / Last Changed By
      UtilsSecurity.filterCreatedAndLastChanged(
        filteredSetting, setting, loggedUser);
    }
    return filteredSetting;
  }

  public static filterSettingsResponse(settings, loggedUser: UserToken, contentFilter = false) {
    const filteredSettings = [];

    if (!settings) {
      return null;
    }
    if (!Authorizations.canListSettings(loggedUser)) {
      return null;
    }
    for (const setting of settings) {
      // Filter
      const filteredSetting = SettingSecurity.filterSettingResponse(setting, loggedUser, contentFilter);
      // Ok?
      if (filteredSetting) {
        // Add
        filteredSettings.push(filteredSetting);
      }
    }
    return filteredSettings;
  }

  private static _filterAuthorizedSettingContent(loggedUser: UserToken, setting: SettingDB) {
    if (!setting.content) {
      return null;
    }
    if (Authorizations.isSuperAdmin(loggedUser) || setting.identifier !== Constants.COMPONENTS.ANALYTICS) {
      return setting.content;
    }
    if (setting.content.links && Array.isArray(setting.content.links)) {
      const filteredLinks = setting.content.links.filter((link) => !link.role || link.role === '' ||
          (link.role && link.role.includes(loggedUser.role)));
      setting.content.links = filteredLinks;
    }
    return setting.content;
  }
}
