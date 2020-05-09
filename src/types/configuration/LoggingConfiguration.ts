export default interface LoggingConfiguration {
  logLevel: string;
  consoleLogLevel: string;
  trace: boolean;
  traceLogOnlyStatistics: boolean;
  traceStatisticInterval: number;
  moduleDetails: {
    ChargingStation: {
      logLevel: string;
      consoleLogLevel: string;
    };
    Authorizations: {
      logLevel: string;
      consoleLogLevel: string;
    };
  };
}
