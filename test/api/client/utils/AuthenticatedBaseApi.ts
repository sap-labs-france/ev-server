import AuthenticationApi from '../AuthenticationApi';
import BaseApi from './BaseApi';
import { StatusCodes } from 'http-status-codes';
import { expect } from 'chai';
import jwt from 'jsonwebtoken';

export default class AuthenticatedBaseApi extends BaseApi {
  private _authenticationApi: AuthenticationApi;
  private _user: string;
  private _password: string;
  private _tenant: string;
  private _token: string;
  private _decodedToken: string;
  private _tenantID: string;

  public constructor(baseURL: string, user: string, password: string, tenant: string) {
    super(baseURL);
    this._authenticationApi = new AuthenticationApi(new BaseApi(baseURL));
    this._user = user;
    this._password = password;
    this._tenant = tenant;
    this._token = null;
    this._tenantID = null;
  }

  public async getTenantID(): Promise<string> {
    if (!this._tenantID) {
      await this.authenticate();
    }
    return this._tenantID;
  }

  public async getTenant(): Promise<string> {
    if (!this._tenantID) {
      await this.authenticate();
    }
    return this._tenant;
  }

  public async authenticate(force = false): Promise<void> {
    // Already logged?
    if (!this._token || force) {
      // No, try to log in
      const response = await this._authenticationApi.login(this._user, this._password, true, this._tenant);
      // Keep the token
      expect(response.status).to.be.eql(StatusCodes.OK);
      expect(response.data).to.have.property('token');
      this._token = response.data.token;
      this._decodedToken = jwt.decode(this._token) as string;
      this._tenantID = jwt.decode(this._token)['tenantID'];
    }
  }

  public async send(data: any): Promise<any> {
    // Authenticate first
    await this.authenticate();
    // Init Headers
    if (!data.headers) {
      data.headers = {};
    }
    // Set the Authorization Header with the token
    data.headers['Authorization'] = `Bearer ${this._token}`;
    // Exec the request
    return super.send(data);
  }

}
