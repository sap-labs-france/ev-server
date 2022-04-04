import chai, { expect } from 'chai';

import BaseApi from '../client/utils/BaseApi';
import { OCPIRole } from '../../../src/types/ocpi/OCPIRole';
import chaiSubset from 'chai-subset';
import config from '../../config';

// Set
chai.use(chaiSubset);

export default class OCPIService {
  public baseURL: string;
  public role: string;
  public token: string;
  public baseApi: BaseApi;

  public constructor(role: OCPIRole) {
    this.baseURL = `${config.get('ocpi.scheme')}://${config.get('ocpi.host')}:${config.get('ocpi.port')}`;
    this.role = role.toLocaleLowerCase();
    this.baseApi = new BaseApi(this.baseURL);
    this.token = OCPIService.getToken(role);
  }

  public static isConfigAvailable(): boolean {
    return (config.get('ocpi.enabled')) ? true : false;

  }

  public static getToken(role: OCPIRole) {
    if (role === OCPIRole.CPO) {
      return `Token ${config.get('ocpi.cpoToken')}`;
    }
    return `Token ${config.get('ocpi.emspToken')}`;

  }

  public async getVersions() {
    console.log('🚀 ~ this.token', this.token);
    console.log('🚀 ~ `ocpi/${this.role}/versions`', `ocpi/${this.role}/versions`);
    return this.baseApi.send({
      method: 'GET',
      url: `ocpi/${this.role}/versions`,
      headers: {
        Authorization: this.token
      }
    });
  }

  public async getImplementation2_1_1() {
    return this.baseApi.send({
      method: 'GET',
      url: `ocpi/${this.role}/2.1.1`,
      headers: {
        Authorization: this.token
      }
    });
  }

  public async getLocations2_1_1() {
    return this.baseApi.send({
      method: 'GET',
      url: `ocpi/${this.role}/2.1.1/locations`,
      headers: {
        Authorization: this.token
      }
    });
  }

  public async postCredentials2_1_1(credential) {
    return this.baseApi.send({
      method: 'POST',
      url: `ocpi/${this.role}/2.1.1/credentials`,
      data: credential,
      headers: {
        Authorization: this.token
      }
    });
  }

  public async accessPath(method, path) {
    return this.baseApi.send({
      method: method,
      url: path,
      headers: {
        Authorization: this.token
      }
    });
  }

  public checkOCPIResponseStructure(ocpiResponse) {
    expect(ocpiResponse).to.not.be.empty;
    expect(ocpiResponse).to.have.property('status_code');
    expect(ocpiResponse).to.have.property('status_message');
    expect(ocpiResponse).to.have.property('data');
    expect(ocpiResponse).to.have.property('timestamp').that.is.not.empty;
  }

  public checkOCPIErrorResponseStructure(ocpiErrorResponse) {
    expect(ocpiErrorResponse).to.not.be.empty;
    expect(ocpiErrorResponse).to.have.property('status_code');
    expect(ocpiErrorResponse).to.have.property('status_message').that.is.not.empty;
    expect(ocpiErrorResponse).to.have.property('timestamp').that.is.not.empty;
  }

  public validateCredentialEntity(credential) {
    expect(credential).to.not.be.empty;
    expect(credential).to.have.property('url').that.is.not.empty;
    expect(credential).to.have.property('token').that.is.not.empty;
    expect(credential).to.have.property('country_code').that.is.not.empty;
    expect(credential).to.have.property('party_id').that.is.not.empty;
  }

  public validateLocationEntity(location) {
    return expect(location).to.have.property('id').that.is.not.empty &&
      expect(location).to.have.property('name').that.is.not.empty;
  }

  public validateEvseEntity(evse) {
    return expect(evse).to.have.property('uid').that.is.not.empty &&
      expect(evse).to.have.property('evse_id').that.is.not.empty &&
      expect(evse).to.have.property('status').that.is.not.empty &&
      expect(evse).to.have.property('connectors').to.be.an('array').that.is.not.empty;
  }

  public validateConnectorEntity(connector) {
    return expect(connector).to.have.property('id') &&
      expect(connector).to.have.property('last_updated').that.is.not.empty;
  }
}
