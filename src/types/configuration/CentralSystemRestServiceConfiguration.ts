import CentralSystemServerConfiguration from './CentralSystemServerConfiguration';

export default interface CentralSystemRestServiceConfiguration extends CentralSystemServerConfiguration {
  userTokenKey: string;
  userTokenLifetimeHours: number;
  userDemoTokenLifetimeDays: number;
  userTechnicalTokenLifetimeDays: number;
  passwordWrongNumberOfTrial: number;
  passwordBlockedWaitTimeMin: number;
  captchaSecretKey: string;
  captchaScore: number;
  debug: boolean;
}
