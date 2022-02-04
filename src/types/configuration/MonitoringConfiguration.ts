import CentralSystemServerConfiguration from './CentralSystemServerConfiguration';
import { MonitoringServerImpl } from '../Monitoring';

export default interface MonitoringConfiguration extends CentralSystemServerConfiguration {
  implementation: MonitoringServerImpl;
  debug: boolean;
}
