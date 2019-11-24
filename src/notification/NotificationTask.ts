import User from '../types/User';
import { OfflineChargingStationNotification, PreparingSessionNotStartedNotification, UserAccountInactivityNotification, ChargingStationRegisteredNotification, ChargingStationStatusErrorNotification, EndOfChargeNotification, EndOfSessionNotification, EndOfSignedSessionNotification, NewRegisteredUserNotification, OCPIPatchChargingStationsStatusesErrorNotification, OptimalChargeReachedNotification, RequestPasswordNotification, SmtpAuthErrorNotification, TransactionStartedNotification, UnknownUserBadgedNotification, UserAccountStatusChangedNotification, VerificationEmailNotification, NotificationSeverity } from '../types/UserNotifications';

export default interface NotificationTask {
  sendEndOfCharge(data: EndOfChargeNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendOptimalChargeReached(data: OptimalChargeReachedNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendEndOfSession(data: EndOfSessionNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendEndOfSignedSession(data: EndOfSignedSessionNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendRequestPassword(data: RequestPasswordNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendUserAccountStatusChanged(data: UserAccountStatusChangedNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendNewRegisteredUser(data: NewRegisteredUserNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendVerificationEmail(data: VerificationEmailNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendChargingStationStatusError(data: ChargingStationStatusErrorNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendChargingStationRegistered(data: ChargingStationRegisteredNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendUnknownUserBadged(data: UnknownUserBadgedNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendSessionStarted(data: TransactionStartedNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendSmtpAuthError(data: SmtpAuthErrorNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendOCPIPatchChargingStationsStatusesError(data: OCPIPatchChargingStationsStatusesErrorNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendUserAccountInactivity(data: UserAccountInactivityNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendPreparingSessionNotStarted(data: PreparingSessionNotStartedNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
  sendOfflineChargingStations(data: OfflineChargingStationNotification, user: User, tenantID: string, severity: NotificationSeverity): Promise<void>;
}
