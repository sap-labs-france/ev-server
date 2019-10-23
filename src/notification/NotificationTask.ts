import User from '../types/User';
import { ForgetChargeNotification, UserInactivityLimitReachedNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, OCPIPatchChargingStationsStatusesErrorNotification, OptimalChargeReachedNotification, RequestPasswordNotification, SmtpAuthErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountStatusChangedNotification, VerificationEmailNotification } from '../types/UserNotifications';

export default interface NotificationTask {
  sendEndOfCharge(data: EndOfChargeNotification, user: User, tenantID: string): Promise<void>;
  sendOptimalChargeReached(data: OptimalChargeReachedNotification, user: User, tenantID: string): Promise<void>;
  sendEndOfSession(data: EndOfSessionNotification, user: User, tenantID: string): Promise<void>;
  sendEndOfSignedSession(data: EndOfSignedSessionNotification, user: User, tenantID: string): Promise<void>;
  sendRequestPassword(data: RequestPasswordNotification, user: User, tenantID: string): Promise<void>;
  sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, user: User, tenantID: string): Promise<void>;
  sendNewRegisteredUser(data: NewRegisteredUserNotification, user: User, tenantID: string): Promise<void>;
  sendVerificationEmail(data: VerificationEmailNotification, user: User, tenantID: string): Promise<void>;
  sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, user: User, tenantID: string): Promise<void>;
  sendChargingStationRegistered(data: ChargingStationRegisteredNotification, user: User, tenantID: string): Promise<void>;
  sendUnknownUserBadged(data: UnknownUserBadgedNotification, user: User, tenantID: string): Promise<void>;
  sendSessionStarted(data: TransactionStartedNotification, user: User, tenantID: string): Promise<void>;
  sendSmtpAuthError(data: SmtpAuthErrorNotification, user: User, tenantID: string): Promise<void>;
  sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification, user: User, tenantID: string): Promise<void>;
  sendUserInactivityLimitReached(data: UserInactivityLimitReachedNotification, user: User, tenantID: string): Promise<void>;
  sendForgetCharge(data: ForgetChargeNotification, user: User, tenantID: string): Promise<void>;
}
