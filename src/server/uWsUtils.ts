import { App, AppOptions, HttpRequest, HttpResponse, SSLApp, TemplatedApp } from 'uWebSockets.js';

import CentralSystemServerConfiguration from '../types/configuration/CentralSystemServer';
import Constants from '../utils/Constants';
import { ServerProtocol } from '../types/Server';
import { ServerUtils } from './ServerUtils';
import { StatusCodes } from 'http-status-codes';
import cluster from 'cluster';

export class uWsUtils {
  public static createApp(serverConfig: CentralSystemServerConfiguration): TemplatedApp {
    let app: TemplatedApp;
    if (serverConfig.sslKey && serverConfig.sslCert) {
      const options: AppOptions = { key_file_name: serverConfig.sslKey, cert_file_name: serverConfig.sslCert };
      app = SSLApp(options);
    } else {
      app = App();
    }
    if (serverConfig.protocol.startsWith(ServerProtocol.HTTP)) {
      app.get(Constants.HEALTH_CHECK_ROUTE, uWsUtils.healthCheckService.bind(this));
    } else if (serverConfig.protocol.startsWith(ServerProtocol.WS)) {
      app.ws(Constants.HEALTH_CHECK_ROUTE, uWsUtils.healthCheckService.bind(this));
    }
    return app;
  }

  public static startServer(serverConfig: CentralSystemServerConfiguration, app: TemplatedApp,
      serverName: string, serverModuleName: string, listenCb?: () => void, listen = true): void {
    let cb: () => void;
    if (listenCb && typeof listenCb === 'function') {
      cb = listenCb;
    } else {
      cb = async () => {
        await ServerUtils.defaultListenCb(serverModuleName, 'startServer', `${serverName} Server listening on '${serverConfig.protocol}://${serverConfig.host ?? '::'}:${serverConfig.port}' ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}`);
      };
    }

    // Listen
    if (serverConfig.host && serverConfig.port && listen) {
      app.listen(serverConfig.host, serverConfig.port, cb);
    } else if (!serverConfig.host && serverConfig.port && listen) {
      app.listen(serverConfig.port, cb);
    } else if (listen) {
      // eslint-disable-next-line no-console
      console.log(`Fail to start ${serverName} Server listening ${cluster.isWorker ? 'in worker ' + cluster.worker.id.toString() : 'in master'}, missing required port configuration`);
    }
  }

  public static healthCheckService(res: HttpResponse, req: HttpRequest): void {
    res.writeStatus(`${StatusCodes.OK} OK`);
    res.end();
  }
}
