import { ServerAction, ServerProtocol, ServerType } from '../types/Server';

import { AddressInfo } from 'net';
import CentralSystemServerConfiguration from '../types/configuration/CentralSystemServerConfiguration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import http from 'http';
import https from 'https';

export class ServerUtils {
  public static async defaultListenCb(serverModuleName: string, methodName: string, serverType: ServerType,
      protocol: ServerProtocol, hostname: string, port: number): Promise<void> {
    const logMsg = `${serverType} Server listening on '${protocol}://${hostname}:${port}'`;
    // Log
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT_ID,
      module: serverModuleName, method: methodName,
      action: ServerAction.STARTUP,
      message: logMsg
    });
    Logging.logConsoleDebug(logMsg);
  }

  public static createHttpServer(serverConfig: CentralSystemServerConfiguration, requestListener: http.RequestListener): http.Server {
    let httpServer: http.Server;
    // Create the HTTP server
    if (serverConfig.protocol === ServerProtocol.HTTPS || serverConfig.protocol === ServerProtocol.WSS) {
      // Create the options
      const options: https.ServerOptions = {};
      // Https server
      httpServer = https.createServer(options, requestListener);
    } else {
      // Http server
      httpServer = http.createServer(requestListener);
    }
    return httpServer;
  }

  public static startHttpServer(serverConfig: CentralSystemServerConfiguration, httpServer: http.Server,
      serverModuleName: string, serverType: ServerType, listenCb?: () => void): void {
    let cb: () => void;
    if (listenCb && typeof listenCb === 'function') {
      cb = listenCb;
    } else {
      cb = async () => {
        await ServerUtils.defaultListenCb(serverModuleName, 'startHttpServer', serverType, serverConfig.protocol, ServerUtils.getHttpServerAddress(httpServer), ServerUtils.getHttpServerPort(httpServer));
      };
    }
    Logging.logConsoleDebug(`Starting ${serverType} Server...`);
    // Listen
    if (serverConfig.host && serverConfig.port) {
      httpServer.listen(serverConfig.port, serverConfig.host, cb);
    } else if (!serverConfig.host && serverConfig.port) {
      httpServer.listen(serverConfig.port, cb);
    } else {
      Logging.logConsoleDebug(`Fail to start ${serverType} Server listening, missing required port configuration`);
    }
  }

  private static getHttpServerPort(httpServer: http.Server): number {
    return (httpServer.address() as AddressInfo).port;
  }

  private static getHttpServerAddress(httpServer: http.Server): string {
    return (httpServer.address() as AddressInfo).address;
  }
}
