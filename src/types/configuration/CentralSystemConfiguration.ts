import CentralSystemServerConfiguration from './CentralSystemServerConfiguration';

export enum CentralSystemImplementation {
  SOAP = 'soap',
  JSON = 'json'
}

export default interface CentralSystemConfiguration extends CentralSystemServerConfiguration {
  implementation: CentralSystemImplementation;
  debug: boolean;
}
