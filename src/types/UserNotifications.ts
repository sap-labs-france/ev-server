import { BillingInvoice } from './Billing';
import NotificationTask from '../notification/NotificationTask';
import User from './User';

export default interface UserNotifications {
  sendSessionStarted: boolean;
  sendOptimalChargeReached: boolean;
  sendEndOfCharge: boolean;
  sendEndOfSession: boolean;
  sendUserAccountStatusChanged: boolean;
  sendNewRegisteredUser: boolean;
  sendUnknownUserBadged: boolean;
  sendChargingStationStatusError: boolean;
  sendChargingStationRegistered: boolean;
  sendOcpiPatchStatusError: boolean;
  sendSmtpAuthError: boolean;
  sendUserAccountInactivity: boolean;
  sendPreparingSessionNotStarted: boolean;
  sendOfflineChargingStations: boolean;
  sendBillingSynchronizationFailed: boolean;
  sendBillingNewInvoice: boolean;
  sendCarCatalogSynchronizationFailed: boolean;
  sendComputeAndApplyChargingProfilesFailed: boolean;
  sendSessionNotStarted: boolean;
  sendEndUserErrorNotification: boolean;
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
 'sendBillingSynchronizationFailed' |
 'sendBillingNewInvoice' |
 'sendSessionNotStarted' |
 'sendCarCatalogSynchronizationFailed' |
 'sendEndUserErrorNotification'
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
  BILLING_USER_SYNCHRONIZATION_FAILED = 'BillingUserSynchronizationFailed',
  BILLING_INVOICE_SYNCHRONIZATION_FAILED = 'BillingInvoiceSynchronizationFailed',
  BILLING_NEW_INVOICE = 'BillingNewInvoice',
  CAR_CATALOG_SYNCHRONIZATION_FAILED = 'CarCatalogSynchronizationFailed',
  CHECK_AND_APPLY_SMART_CHARGING_FAILED = 'ComputeAndApplyChargingProfilesFailed',
  SESSION_NOT_STARTED_AFTER_AUTHORIZE = 'SessionNotStartedAfterAuthorize',
  END_USER_ERROR_NOTIFICATION = 'EndUserErrorNotification'
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
  evseDashboardTagURL: string;
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
  evseDashboardBillingURL: string;
}

export interface BillingInvoiceSynchronizationFailedNotification extends BaseNotification {
  nbrInvoicesInError: number;
  evseDashboardURL: string;
  evseDashboardBillingURL: string;
}

export interface BillingNewInvoiceNotification extends BaseNotification {
  evseDashboardURL: string;
  evseDashboardInvoiceURL: string;
  user: User;
  invoice: BillingInvoice;
  invoiceDownloadUrl: string;
}

export interface CarCatalogSynchronizationFailedNotification extends BaseNotification {
  nbrCarsInError: number;
  evseDashboardURL: string;
}

export interface ComputeAndApplyChargingProfilesFailedNotification extends BaseNotification {
  siteAreaName: string;
  chargeBoxID: string;
  evseDashboardURL: string;
}
export interface NotificationSource {
  channel: 'email'|'remote-push-notification';
  notificationTask: NotificationTask;
  enabled: boolean;
}

export interface Notification {
  id: string;
  userID: string;
  user?: User;
  timestamp: Date;
  channel: string;
  sourceId: string;
  sourceDescr: string;
  chargeBoxID: string;
  data: any;
}

export interface SessionNotStartedNotification extends BaseNotification {
  chargeBoxID: string;
  user: User;
  evseDashboardURL: string;
  evseDashboardChargingStationURL: string;
}

export interface EndUserErrorNotification extends BaseNotification {
  userID: string;
  email: string;
  name: string;
  errorTitle: string;
  errorDescription: string;
  phone: string;
  evseDashboardURL: string;
}

