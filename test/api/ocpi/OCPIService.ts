import BaseApi from '../client/utils/BaseApi';
import config from '../../config';
import { expect } from 'chai';
import chai from 'chai';
import chaiSubset from 'chai-subset';

// Set
chai.use(chaiSubset);

export default class OCPIService {

  public baseURL: any;
  public token: any;
  public baseApi: BaseApi;

  constructor() {
    this.baseURL = `${config.get('ocpi.scheme')}://${config.get('ocpi.host')}:${config.get('ocpi.port')}`;

    // build token
    this.token = `Token ${config.get('ocpi.token')}`;

    // Create the Base API
    this.baseApi = new BaseApi(this.baseURL);
  }

  /**
   * Get Version url
   */
  async getVersions() {
    return this.baseApi.send({
      method: 'GET',
      url: 'ocpi/cpo/versions'
    });
  }

  /**
   * Check if Configuration Exist
   */
  static isConfigAvailable() {
    return (config.get('ocpi.enabled'))?true:false;

  }

  static getToken() {
    return (config.get('ocpi.token'));
  }

  /**
   * Get Implementation for 2.1.1
   */
  async getImplementation2_1_1() {
    return this.baseApi.send({
      method: 'GET',
      url: 'ocpi/cpo/2.1.1'
    });
  }

  /**
   * Get Locations for 2.1.1
   */
  async getLocations2_1_1() {
    return this.baseApi.send({
      method: 'GET',
      url: 'ocpi/cpo/2.1.1/locations',
      headers: {
        Authorization: this.token
      }
    });
  }

  /**
   * POST Credentials for 2.1.1
   */
  async postCredentials2_1_1(credentail) {
    return this.baseApi.send({
      method: 'POST',
      url: 'ocpi/cpo/2.1.1/credentials',
      data: credentail,
      headers: {
        Authorization: this.token
      }
    });
  }

  /**
   * Access path with specific method
   * @param {*} method 
   * @param {*} path 
   */
  async accessPath(method, path) {
    return this.baseApi.send({
      method: method,
      url: path,
      headers: {
        Authorization: this.token
      }
    });
  }

  /**
   * Check basic structure for OCPI Response
   * @param {*} ocpiResponse 
   */
  checkOCPIResponseStructure(ocpiResponse) {
    expect(ocpiResponse).to.not.be.empty;
    expect(ocpiResponse).to.have.property('status_code');
    expect(ocpiResponse).to.have.property('status_message');
    expect(ocpiResponse).to.have.property('data');
    expect(ocpiResponse).to.have.property('timestamp').that.is.not.empty;
  }

  /**
   * Check basic structure for OCPI Error Response
   * @param {*} ocpiErrorResponse 
   */
  checkOCPIErrorResponseStructure(ocpiErrorResponse) {
    expect(ocpiErrorResponse).to.not.be.empty;
    expect(ocpiErrorResponse).to.have.property('status_code');
    expect(ocpiErrorResponse).to.have.property('status_message').that.is.not.empty;
    expect(ocpiErrorResponse).to.have.property('timestamp').that.is.not.empty;
  }

  /**
   * Validate Credential Entity
   * @param {*} credential 
   */
  validateCredentialEntity(credential) {
    expect(credential).to.not.be.empty;
    expect(credential).to.have.property('url').that.is.not.empty;
    expect(credential).to.have.property('token').that.is.not.empty;
    expect(credential).to.have.property('country_code').that.is.not.empty;
    expect(credential).to.have.property('party_id').that.is.not.empty;
  }

  /**
   * Validate Location Entity
   * @param {*} location 
   */
  validateLocationEntity(location) {
    return expect(location).to.have.property('id').that.is.not.empty &&
      expect(location).to.have.property('name').that.is.not.empty;
  }

  /**
   * Validate EVSE Entity
   * @param {*} evse 
   */
  validateEvseEntity(evse) {
    return expect(evse).to.have.property('uid').that.is.not.empty &&
      expect(evse).to.have.property('id').that.is.not.empty &&
      expect(evse).to.have.property('status').that.is.not.empty &&
      expect(evse).to.have.property('connectors').to.be.an('array').that.is.not.empty;
  }

  /**
   * Validate Connector Entity
   * @param {*} connector
   */
  validateConnectorEntity(connector) {
    return expect(connector).to.have.property('id') &&
      expect(connector).to.have.property('last_update').that.is.not.empty;
  }




}
