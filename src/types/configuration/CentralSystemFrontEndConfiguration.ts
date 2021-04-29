import CentralSystemServerConfiguration from './CentralSystemServerConfiguration';

export default interface CentralSystemFrontEndConfiguration extends CentralSystemServerConfiguration {
  distEnabled?: boolean;
  distPath?: string;
}
