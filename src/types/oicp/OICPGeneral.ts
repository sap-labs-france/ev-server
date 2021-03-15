export enum OICPVersion {
  V230 = '2.3.0', // Version of OICP Protocol
}

export enum HubjectBaseurls {
  QA = 'https://service-qa.hubject.com',
  PRODUCTIVE = 'https://service.hubject.com',
}

// Available CPO Endpoints for OICP Protocol 2.3.0
export enum OICPEndpointPaths {
  EVSE_DATA = '/api/oicp/evsepush/v23/operators/{operatorID}/data-records',
  STATUSES = '/api/oicp/evsepush/v21/operators/{operatorID}/status-records',
  AUTHORIZE_START = '/api/oicp/charging/v21/operators/{operatorID}/authorize/start',
  AUTHORIZE_STOP = '/api/oicp/charging/v21/operators/{operatorID}/authorize/stop',
  PRICING = '/api/oicp/dynamicpricing/v10/operators/{operatorID}/evse-pricing',
  CDR = '/api/oicp/cdrmgmt/v22/operators/{operatorID}/charge-detail-record',
  PRICING_PRODUCTS = '/api/oicp/dynamicpricing/v10/operators/{operatorID}/pricing-products',
  NOTIFICATIONS = '/api/oicp/notificationmgmt/v11/charging-notifications'
}

// Set batch size for sending all EVSEs to Hubject to avoid maxBodyLength limit of requests
export enum OICPBatchSize {
  EVSE_DATA = 10000,
}
