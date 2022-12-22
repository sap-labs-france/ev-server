import { Log, LogLevel } from '../types/Log';

import Logging from './Logging';

export default class LightLogger {

  private logLevel: LogLevel;

  public constructor(logLevel: LogLevel) {
    this.logLevel = logLevel;
  }

  public log(log: Log): void {
    log.level = this.logLevel;
    log.timestamp = new Date();
    Logging.lightLog(log);
  }
}

