import { Factory } from 'rosie';
import UserNotifications from '../types/UserNotifications';
import faker from 'faker';

const userFactory = Factory.define('user')
  .attr('firstName', () => faker.name.firstName())
  .attr('name', () => faker.name.lastName().toUpperCase())
  .attr('email', () => faker.internet.email().toLowerCase())
  .attr('passwords', () => {
    const password = faker.internet.password() + '@1Aa';
    return {
      password: password,
      repeatPassword: password
    };
  })
  .attr('notifications', (): UserNotifications => ({
    sendSessionStarted: true,
    sendOptimalChargeReached: true,
    sendEndOfCharge: true,
    sendEndOfSession: true,
    sendUserAccountStatusChanged: true,
    sendNewRegisteredUser: false,
    sendUnknownUserBadged: false,
    sendChargingStationStatusError: false,
    sendChargingStationRegistered: false,
    sendOcpiPatchStatusError: false,
    sendSmtpAuthError: false,
    sendUserAccountInactivity: false,
    sendPreparingSessionNotStarted: false,
    sendOfflineChargingStations: false,
    sendBillingSynchronizationFailed: false,
    sendSessionNotStarted: false,
    sendCarCatalogSynchronizationFailed: false,
    sendEndUserErrorNotification: false,
    sendComputeAndApplyChargingProfilesFailed: false,
    sendBillingNewInvoice: false
  }))
  .attr('role', 'B')
  .attr('status', 'A')
  .attr('locale', 'en_US');

const registerUserFactory = Factory.define('user')
  .attr('firstName', () => faker.name.firstName())
  .attr('name', () => faker.name.lastName())
  .attr('email', () => faker.internet.email())
  .attr('passwords', () => {
    const password = faker.internet.password() + '@1Aa';
    return {
      password: password,
      repeatPassword: password
    };
  })
  .attr('acceptEula', true)
  .attr('locale', 'en_US')
  .attr('captcha', '03AMGVjXiyflPJpUOJF-AW2YP9-uQZvbVKsnx2CaESTX7mr59laYB0KKn7QERpWk-cadi1e2D0oYyjClv6UcYJ3IrYI951f2uopiLQv8ykAKEz3TQ3ZWgYJQSvItSZ7cd8wSFl7EF9aVEIHJobWg4OljtmSf2YUyXFnma76ih089LfUe0uSQC8piAT6DJ5WVcNaR827jbJrzCtYSPFX8u_GSFM6jCQU0RdnFgTuFIst2hyZ_FfiKJSpG9pSF2avSie1R-y6PVJktxNHdDaTuN4PK-AucjKrHSO9A');

export default class UserFactory {
  static build(attributes?, options?) {
    return userFactory.build(attributes, options);
  }

  static buildRegisterUser(attributes?, options?) {
    return registerUserFactory.build(attributes, options);
  }
}
