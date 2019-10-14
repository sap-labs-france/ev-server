export default interface UserNotifications {
  sendSessionStarted?: boolean;
  sendOptimalChargeReached?: boolean;
  sendEndOfCharge?: boolean;
  sendEndOfSession?: boolean;
  sendUserAccountStatusChanged?: boolean;
  sendNewRegisteredUser?: boolean;
  sendUnknownUserBadged?: boolean;
  sendChargingStationStatusError?: boolean;
  sendChargingStationRegistered?: boolean;
  sendOcpiPatchStatusError?: boolean;
  sendSmtpAuthError?: boolean;
}
