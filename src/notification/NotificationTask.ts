import NotificationResult from './NotificationResult';

export default abstract class NotificationTask {

  // TODO: Since data param varies heavily by impl
  // I cannot create a robust class for it without knowing more about the code
  // Therefore, type: any for now. Please change


  abstract sendNewRegisteredUser(data: any, locale: string, tenantID: string): NotificationResult;
  abstract sendRequestPassword(data: any, locale: string, tenantID: string): NotificationResult;
  abstract sendNewPassword(data: any, locale: string, tenantID: string): NotificationResult;
  abstract sendEndOfCharge(data: any, locale: string, tenantID: string): NotificationResult;
  abstract sendEndOfSession(data: any, locale: string, tenantID: string): NotificationResult;
  abstract sendChargingStationStatusError(data: any, locale: string, tenantID: string): NotificationResult;
  abstract sendUnknownUserBadged(data: any, locale: string, tenantID: string): NotificationResult;
  abstract sendTransactionStarted(data: any, locale: string, tenantID: string): NotificationResult;
  abstract sendChargingStationRegistered(data: any, locale: string, tenantID: string): NotificationResult;

}


