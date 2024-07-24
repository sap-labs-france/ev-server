import HttpByIDRequest from './HttpByIDRequest';
// import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpWalletRechargeRequest extends HttpByIDRequest {
  mobile: string;
  ID: string;
  WalletBalance:number;
  amount : number;
}
