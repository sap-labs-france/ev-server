import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpBillingRequest extends HttpDatabaseRequest {
  tenantID?: string;
}
