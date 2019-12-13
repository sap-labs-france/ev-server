

export default interface SmartChargingConnector {
  callOptimizer(tenantID: string): Promise<any>;
}
