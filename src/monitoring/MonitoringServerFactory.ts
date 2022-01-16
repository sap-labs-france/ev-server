import MonitoringConfiguration from '../types/configuration/MonitoringConfiguration';
import MonitoringServer from './MonitoringServer';
import { MonitoringServerImpl } from '../types/Monitoring';
import PrometheusMonitoringServer from './prometheus/PrometheusMonitoringServer';

export default class MonitoringServerFactory {
  public static getMonitoringServerImpl(monitoringConfig: MonitoringConfiguration): MonitoringServer {
    switch (monitoringConfig.implementation) {
      case MonitoringServerImpl.PROMETHEUS:
        return new PrometheusMonitoringServer(monitoringConfig);
    }
  }
}

