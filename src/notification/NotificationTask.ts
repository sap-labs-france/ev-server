import { ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, OCPIPatchChargingStationsStatusesErrorNotification, OptimalChargeReachedNotification, RequestPasswordNotification, SmtpAuthErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountStatusChangedNotification, VerificationEmailNotification } from '../types/UserNotifications';
import NotificationResult from './NotificationResult';

export default interface NotificationTask {
  sendEndOfCharge(data: EndOfChargeNotification, locale: string, tenantID: string): Promise<void>;
  sendOptimalChargeReached(data: OptimalChargeReachedNotification, locale: string, tenantID: string): Promise<void>;
  sendEndOfSession(data: EndOfSessionNotification, locale: string, tenantID: string): Promise<void>;
  sendEndOfSignedSession(data: EndOfSignedSessionNotification, locale: string, tenantID: string): Promise<void>;
  sendRequestPassword(data: RequestPasswordNotification, locale: string, tenantID: string): Promise<void>;
  sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, locale: string, tenantID: string): Promise<void>;
  sendNewRegisteredUser(data: NewRegisteredUserNotification, locale: string, tenantID: string): Promise<void>;
  sendVerificationEmail(data: VerificationEmailNotification, locale: string, tenantID: string): Promise<void>;
  sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, locale: string, tenantID: string): Promise<void>;
  sendChargingStationRegistered(data: ChargingStationRegisteredNotification, locale: string, tenantID: string): Promise<void>;
  sendUnknownUserBadged(data: UnknownUserBadgedNotification, locale: string, tenantID: string): Promise<void>;
  sendSessionStarted(data: TransactionStartedNotification, locale: string, tenantID: string): Promise<void>;
  sendSmtpAuthError(data: SmtpAuthErrorNotification, locale: string, tenantID: string): Promise<void>;
  sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification, locale: string, tenantID: string): Promise<void>;
}
