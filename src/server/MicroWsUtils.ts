import { App, AppOptions, HttpRequest, HttpResponse, SSLApp, TemplatedApp } from 'uWebSockets.js';

import CentralSystemServerConfiguration from '../types/configuration/CentralSystemServerConfiguration';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import { ServerProtocol } from '../types/Server';
import { ServerUtils } from './ServerUtils';
import { StatusCodes } from 'http-status-codes';
import cluster from 'cluster';

export class MicroWsUtils {
  public static createApp(serverConfig: CentralSystemServerConfiguration): TemplatedApp {
    let app: TemplatedApp;
    if (serverConfig.sslKey && serverConfig.sslCert) {
      const options: AppOptions = { key_file_name: serverConfig.sslKey, cert_file_name: serverConfig.sslCert };
      app = SSLApp(options);
    } else {
      app = App();
    }
    if (Configuration.getHealthCheckConfig().enabled && serverConfig.protocol.startsWith(ServerProtocol.HTTP)) {
      app.get(Constants.HEALTH_CHECK_ROUTE, MicroWsUtils.healthCheckService.bind(this));
    } else if (Configuration.getHealthCheckConfig().enabled && serverConfig.protocol.startsWith(ServerProtocol.WS)) {
      app.ws(Constants.HEALTH_CHECK_ROUTE, MicroWsUtils.healthCheckService.bind(this));
    }
    return app;
  }

  public static startServer(serverConfig: CentralSystemServerConfiguration, app: TemplatedApp,
      serverName: string, serverModuleName: string, listenCb?: () => void): void {
    let cb: () => void;
    if (listenCb && typeof listenCb === 'function') {
      cb = listenCb;
    } else {
      cb = async () => {
        await ServerUtils.defaultListenCb(serverModuleName, 'startServer', serverName, serverConfig.protocol, serverConfig.host ?? '::', serverConfig.port);
      };
    }
    // Listen
    if (serverConfig.host && serverConfig.port) {
      app.listen(serverConfig.host, serverConfig.port, cb);
    } else if (!serverConfig.host && serverConfig.port) {
      app.listen(serverConfig.port, cb);
    } else {
      // eslint-disable-next-line no-console
      console.log(`Fail to start ${serverName} Server listening ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}, missing required port configuration`);
    }
  }

  public static healthCheckService(res: HttpResponse, req: HttpRequest): void {
    res.writeStatus(`${StatusCodes.OK} OK`);
    res.end();
  }
}
