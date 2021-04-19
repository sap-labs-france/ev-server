export default interface LoggingConfiguration {
  logLevel: string;
  trace: boolean;
  traceLogOnlyStatistics: boolean;
  traceStatisticInterval: number;
  moduleDetails: {
    ChargingStation: {
      logLevel: string;
    };
    Authorizations: {
      logLevel: string;
    };
  };
}
