import Asset from '../types/Asset';
import { Car } from '../types/Car';
import ChargingStation from '../types/ChargingStation';
import { PricingContext } from '../types/Pricing';
import RegistrationToken from '../types/RegistrationToken';
import Site from '../types/Site';
import SiteArea from '../types/SiteArea';
import Tag from '../types/Tag';
import Transaction from '../types/Transaction';
import User from '../types/User';
import WSConnection from '../server/ocpp/json/web-socket/WSConnection';
import WSWrapper from '../server/ocpp/json/web-socket/WSWrapper';

export default class LoggingHelper {

  public static getPricingContextProperties(pricingContext: PricingContext): { siteID: string; siteAreaID: string; companyID: string; chargingStationID: string; actionOnUser: string } {
    return {
      siteID: pricingContext?.siteID,
      siteAreaID: pricingContext?.siteAreaID,
      companyID: pricingContext?.companyID,
      chargingStationID: pricingContext?.chargingStationID,
      actionOnUser: pricingContext?.userID,
    };
  }

  public static getTransactionProperties(transaction: Transaction): { siteID: string; siteAreaID: string; companyID: string; chargingStationID: string; actionOnUser: User } {
    return {
      siteID: transaction?.siteID,
      siteAreaID: transaction?.siteAreaID,
      companyID: transaction?.companyID,
      chargingStationID: transaction?.chargeBoxID,
      actionOnUser: transaction?.user,
    };
  }

  public static getChargingStationProperties(chargingStation: ChargingStation): { siteID: string; siteAreaID: string; companyID: string; chargingStationID: string; } {
    return {
      siteID: chargingStation?.siteID,
      siteAreaID: chargingStation?.siteAreaID,
      companyID: chargingStation?.companyID,
      chargingStationID: chargingStation?.id,
    };
  }

  public static getWSWrapperProperties(wsWrapper: WSWrapper): { siteID: string; siteAreaID: string; companyID: string; chargingStationID } {
    return {
      siteID: wsWrapper?.wsConnection?.getSiteID(),
      siteAreaID: wsWrapper?.wsConnection?.getSiteAreaID(),
      companyID: wsWrapper?.wsConnection?.getCompanyID(),
      chargingStationID: wsWrapper?.wsConnection?.getChargingStationID(),
    };
  }

  public static getWSConnectionProperties(wsConnection: WSConnection): { siteID: string; siteAreaID: string; companyID: string; chargingStationID } {
    return {
      siteID: wsConnection?.getSiteID(),
      siteAreaID: wsConnection?.getSiteAreaID(),
      companyID: wsConnection?.getCompanyID(),
      chargingStationID: wsConnection?.getChargingStationID(),
    };
  }

  public static getAssetProperties(asset: Asset): { siteID: string; siteAreaID: string; companyID: string; } {
    return {
      siteID: asset?.siteID,
      siteAreaID: asset?.siteAreaID,
      companyID: asset?.companyID,
    };
  }

  public static getSiteProperties(site: Site): { siteID: string; companyID: string; } {
    return {
      siteID: site?.id,
      companyID: site?.companyID,
    };
  }

  public static getSiteAreaProperties(siteArea: SiteArea): { siteID: string; siteAreaID: string; } {
    return {
      siteAreaID: siteArea?.id,
      siteID: siteArea?.siteID,
    };
  }

  public static getCarProperties(car: Car): { userID: string } {
    return {
      userID: car?.userID,
    };
  }

  public static getRegistrationTokenProperties(registrationToken: RegistrationToken): { siteAreaID: string } {
    return {
      siteAreaID: registrationToken?.siteAreaID
    };
  }

  public static getTagProperties(tag: Tag): { userID: string } {
    return {
      userID: tag?.userID
    };
  }

  public static getSourceDataProperties(sourceData: any): { siteID: string, siteAreaID?: string, companyID: string, chargingStationID: string } {
    return {
      siteID: sourceData?.siteID,
      siteAreaID: sourceData?.siteAreaID,
      companyID: sourceData?.companyID,
      chargingStationID: sourceData?.chargeBoxID,
    };
  }
}
