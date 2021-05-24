export default interface AdvancedConfiguration {
  globalAuthenticationService?: string; /* built-in | xsuaa*/
}

export enum AuthServiceType {
  XSUAA = 'xsuaa',
  BUILT_IN = 'built-in'
}
