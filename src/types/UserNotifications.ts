import User from './User';
import NotificationTask from '../notification/NotificationTask';

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
  sendUserAccountInactivity?: boolean;
  sendPreparingSessionNotStarted?: boolean;
  sendOfflineChargingStations?: boolean;
  sendBillingSynchronizationFailed?: boolean;
}

export type UserNotificationKeys =
 'sendSessionStarted' |
 'sendOptimalChargeReached' |
 'sendEndOfCharge' |
 'sendEndOfSession' |
 'sendUserAccountStatusChanged' |
 'sendUnknownUserBadged' |
 'sendChargingStationStatusError' |
 'sendChargingStationRegistered' |
 'sendOcpiPatchStatusError' |
 'sendSmtpAuthError' |
 'sendUserAccountInactivity' |
 'sendPreparingSessionNotStarted' |
 'sendOfflineChargingStations' |
 'sendBillingSynchronizationFailed'
;

export enum UserNotificationType {
  SESSION_STARTED = 'SessionStarted',
  OPTIMAL_CHARGE_REACHED = 'OptimalChargeReached',
  END_OF_CHARGE = 'EndOfCharge',
  END_OF_SESSION = 'EndOfSession',
  USER_ACCOUNT_STATUS_CHANGED = 'UserAccountStatusChanged',
  UNKNOWN_USER_BADGED = 'UnknownUserBadged',
  CHARGING_STATION_STATUS_ERROR = 'ChargingStationStatusError',
  CHARGING_STATION_REGISTERED = 'ChargingStationRegistered',
  OCPI_PATCH_STATUS_ERROR = 'OcpiPatchStatusError',
  SMTP_AUTH_ERROR = 'SmtpAuthError',
  PREPARING_SESSION_NOT_STARTED = 'PreparingSessionNotStarted',
  USER_ACCOUNT_INACTIVITY = 'UserAccountInactivity',
  OFFLINE_CHARGING_STATION = 'OfflineChargingStation',
  BILLING_USER_SYNCHRONIZATION_FAILED = 'BillingUserSynchronizationFailed'
}

export enum NotificationSeverity {
  INFO = '#00376C',
  WARNING = '#FB8C00',
  ERROR = '#ee0000'
}

interface BaseNotification {
}

export interface EndOfChargeNotification extends BaseNotification {
  user: User;
  transactionId: number;
  chargeBoxID: string;
  connectorId: string;
  totalConsumption: string;
  stateOfCharge: number;
  totalDuration: string;
  evseDashboardChargingStationURL: string;
  evseDashboardURL: string;
}

export interface OptimalChargeReachedNotification extends BaseNotification {
  user: User;
  transactionId: number;
  chargeBoxID: string;
  connectorId: string;
  totalConsumption: string;
  stateOfCharge: number;
  evseDashboardChargingStationURL: string;
  evseDashboardURL: string;
}


export interface EndOfSessionNotification extends BaseNotification {
  user: User;
  alternateUser: User;
  transactionId: number;
  chargeBoxID: string;
  connectorId: string;
  totalConsumption: string;
  totalInactivity: string;
  stateOfCharge: number;
  totalDuration: string;
  evseDashboardChargingStationURL: string;
  evseDashboardURL: string;
}

export interface EndOfSignedSessionNotification extends BaseNotification {
  user: User;
  alternateUser: User;
  transactionId: number;
  chargeBoxID: string;
  connectorId: string;
  tagId: string;
  startDate: string;
  endDate: string;
  meterStart: string;
  meterStop: string;
  totalConsumption: string;
  price: number;
  relativeCost: number;
  startSignedData: string;
  endSignedData: string;
  evseDashboardURL: string;
}

export interface RequestPasswordNotification extends BaseNotification {
  user: User;
  evseDashboardResetPassURL: string;
  evseDashboardURL: string;
}

export interface UserAccountStatusChangedNotification extends BaseNotification {
  user: User;
  evseDashboardURL: string;
}

export interface NewRegisteredUserNotification extends BaseNotification {
  tenant: string;
  user: User;
  evseDashboardURL: string;
  evseDashboardVerifyEmailURL: string;
}

export interface VerificationEmailNotification extends BaseNotification {
  user: User;
  evseDashboardURL: string;
  evseDashboardVerifyEmailURL: string;
}

export interface ChargingStationStatusErrorNotification extends BaseNotification {
  chargeBoxID: string;
  connectorId: string;
  error: string;
  evseDashboardURL: string;
  evseDashboardChargingStationURL: string;
}

export interface ChargingStationRegisteredNotification extends BaseNotification {
  chargeBoxID: string;
  evseDashboardURL: string;
  evseDashboardChargingStationURL: string;
}

export interface UnknownUserBadgedNotification extends BaseNotification {
  chargeBoxID: string;
  badgeID: string;
  evseDashboardURL: string;
  evseDashboardUserURL: string;
}

export interface TransactionStartedNotification extends BaseNotification {
  user: User;
  transactionId: number;
  chargeBoxID: string;
  connectorId: string;
  evseDashboardURL: string;
  evseDashboardChargingStationURL: string;
}

export interface SmtpAuthErrorNotification extends BaseNotification {
  evseDashboardURL: string;
}

export interface OCPIPatchChargingStationsStatusesErrorNotification extends BaseNotification {
  location: string;
  evseDashboardURL: string;
}

export interface UserAccountInactivityNotification extends BaseNotification {
  user: User;
  lastLogin: string;
  evseDashboardURL: string;
}

export interface PreparingSessionNotStartedNotification extends BaseNotification {
  user: User;
  chargeBoxID: string;
  connectorId: string;
  startedOn: string;
  evseDashboardURL: string;
  evseDashboardChargingStationURL: string;
}

export interface OfflineChargingStationNotification extends BaseNotification {
  chargeBoxIDs: string;
  evseDashboardURL: string;
}

export interface BillingUserSynchronizationFailedNotification extends BaseNotification {
  nbrUsersInError: number;
  evseDashboardURL: string;
  evseDashnoardBillingURL: string;
}

export interface NotificationSource {
  channel: 'email'|'remote-push-notification';
  notificationTask: NotificationTask;
  enabled: boolean;
}

export interface Notification {
  userID: string;
  timestamp: Date;
  channel: string;
  sourceId: string;
  sourceDescr: string;
  data: any;
  chargeBoxID: string;
}

