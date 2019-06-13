import {expect} from 'chai';
import BaseApi from './BaseApi';
import AuthenticationApi from '../AuthenticationApi';
import jwt from 'jsonwebtoken';

export default class AuthenticatedBaseApi extends BaseApi {
  private _authenticationApi: AuthenticationApi;
  private _user;
  private _password;
  private _tenant;
  private _token;
  private _tenantID;

  public constructor(baseURL, user, password, tenant) {
    super(baseURL);
    this._authenticationApi = new AuthenticationApi(new BaseApi(baseURL));
    this._user = user;
    this._password = password;
    this._tenant = tenant;
    this._token = null;
    this._tenantID = null;
  }

  public async getTenantID() {
    if (!this._tenantID) {
      await this.authenticate();
    }
    return this._tenantID;
  }

  public async getTenant() {
    if (!this._tenantID) {
      await this.authenticate();
    }
    return this._tenant;
  }

  public async authenticate() {
    // Already logged?
    if (!this._token) {
      // No, try to log in
      const response = await this._authenticationApi.login(this._user, this._password, true, this._tenant);
      // Keep the token
      expect(response.status).to.be.eql(200);
      expect(response.data).to.have.property('token');
      this._token = response.data.token;
      this._tenantID = jwt.decode(this._token)['tenantID'];
    }
  }

  public async send(data) {
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

// module.exports = AuthenticatedBaseApi