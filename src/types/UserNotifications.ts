import User from "./User";
import NotificationTask from "../notification/NotificationTask";

export default interface UserNotifications {
  sendSessionStarted?: boolean;
  sendOptimalChargeReached?: boolean;
  sendEndOfCharge?: boolean;
  sendEndOfSession?: boolean;
  sendUserAccountStatusChanged?: boolean;
  sendUnknownUserBadged?: boolean;
  sendChargingStationStatusError?: boolean;
  sendChargingStationRegistered?: boolean;
  sendOcpiPatchStatusError?: boolean;
  sendSmtpAuthError?: boolean;
}

export type UserNotificationKeys =
 "sendSessionStarted" |
 "sendOptimalChargeReached" |
 "sendEndOfCharge" |
 "sendEndOfSession" |
 "sendUserAccountStatusChanged" |
 "sendUnknownUserBadged" |
 "sendChargingStationStatusError" |
 "sendChargingStationRegistered" |
 "sendOcpiPatchStatusError" |
 "sendSmtpAuthError"
;

interface BaseNotification {
  adminUsers?: User[];
}

export interface EndOfChargeNotification extends BaseNotification {
  'user': User;
  'transactionId': number;
  'chargeBoxID': string;
  'connectorId': number;
  'totalConsumption': string;
  'stateOfCharge': number;
  'totalDuration': string;
  'evseDashboardChargingStationURL': string;
  'evseDashboardURL': string;
}

export interface OptimalChargeReachedNotification extends BaseNotification {
  'user': User;
  'transactionId': number;
  'chargeBoxID': string;
  'connectorId': number;
  'totalConsumption': string;
  'stateOfCharge': number;
  'evseDashboardChargingStationURL': string;
  'evseDashboardURL': string;
}


export interface EndOfSessionNotification extends BaseNotification {
  'user': User;
  'alternateUser': User;
  'transactionId': number;
  'chargeBoxID': string;
  'connectorId': number;
  'totalConsumption': string;
  'totalInactivity': string;
  'stateOfCharge': number;
  'totalDuration': string;
  'evseDashboardChargingStationURL': string;
  'evseDashboardURL': string;
}

export interface EndOfSignedSessionNotification extends BaseNotification {
  'user': User;
  'alternateUser': User;
  'transactionId': number;
  'chargeBoxID': string;
  'connectorId': number;
  'tagId': string;
  'startDate': string;
  'endDate': string;
  'meterStart': string;
  'meterStop': string;
  'totalConsumption': string;
  'price': number;
  'relativeCost': number;
  'startSignedData': string;
  'endSignedData': string;
  'evseDashboardURL': string;
}

export interface RequestPasswordNotification extends BaseNotification {
  'user': User;
  'evseDashboardResetPassURL': string;
  'evseDashboardURL': string;
}

export interface UserAccountStatusChangedNotification extends BaseNotification {
  'user': User;
  'evseDashboardURL': string;
}

export interface NewRegisteredUserNotification extends BaseNotification {
  'tenant': string,
  'user': User;
  'evseDashboardURL': string;
  'evseDashboardVerifyEmailURL': string;
}

export interface VerificationEmailNotification extends BaseNotification {
  'user': User;
  'evseDashboardURL': string;
  'evseDashboardVerifyEmailURL': string;
}

export interface ChargingStationStatusErrorNotification extends BaseNotification {
  'chargeBoxID': string;
  'connectorId': number;
  'error': string;
  'evseDashboardURL': string;
  'evseDashboardChargingStationURL': string;
}

export interface ChargingStationRegisteredNotification extends BaseNotification {
  'chargeBoxID': string;
  'evseDashboardURL': string;
  'evseDashboardChargingStationURL': string;
}

export interface UnknownUserBadgedNotification extends BaseNotification {
  'chargeBoxID': string;
  'badgeId': string;
  'evseDashboardURL': string;
  'evseDashboardUserURL': string;
}

export interface TransactionStartedNotification extends BaseNotification {
  'user': User;
  'transactionId': number; 
  'chargeBoxID': string;
  'connectorId': number;
  'evseDashboardURL': string;
  'evseDashboardChargingStationURL': string;
}

export interface SmtpAuthErrorNotification extends BaseNotification {
  'evseDashboardURL': string;
}

export interface OCPIPatchChargingStationsStatusesErrorNotification extends BaseNotification {
  'locationID': string;
  'evseDashboardURL': string;
}

export interface NotificationSource {
  channel: 'email'|'remote-push-notification';
  notificationTask: NotificationTask;
  enabled: boolean;
}

export default interface Notification {
  userID: string;
  timestamp: Date;
  channel: string;
  sourceId: string;
  sourceDescr: string;
  data: any;
  chargeBoxID: string;
}


