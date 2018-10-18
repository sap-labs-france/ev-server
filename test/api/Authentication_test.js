const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const BaseApi = require('./client/utils/BaseApi');
const config = require('../config');

const email = config.get('admin.username');
const password = config.get('admin.password');
const tenant = config.get('admin.tenant');
const baseApi = new BaseApi(`${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`);
const login = (data) => {
  return baseApi.send({
    method: 'POST',
    url: '/client/auth/Login',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: data
  })
};


describe('Authentication Service', () => {

  it('should authenticate a registered user', async () => {
    let response = await login({
      email: email,
      password: password,
      tenant: tenant,
      acceptEula: 'true'
    });
    expect(response.status).to.be.eql(200);
    expect(response.data).to.have.property('token');
    expect(response.data.token).to.be.a('string');
  });

  describe('Password errors', () => {
    it('should not allow authentication of known user with wrong password', async () => {
      let response = await login({
        email: email,
        password: 'another',
        tenant: tenant,
        acceptEula: 'true'
      });
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });
    it('should not allow authentication without password', async () => {
      let response = await login({
        email: email,
        acceptEula: 'true'
      });
      expect(response.status).to.be.eql(500);
      expect(response.data).to.not.have.property('token');
    });
  });
  describe('Eula errors', () => {
    it('should not allow authentication not accepting eula', async () => {
      let response = await login({
        email: email,
        password: password,
        tenant: tenant,
        acceptEula: false
      });
      expect(response.status).to.be.eql(520);
      expect(response.data).to.not.have.property('token');
    });
    it('should not allow authentication without eula', async () => {
      let response = await login({
        email: email,
        tenant: tenant,
        password: password,
      });
      expect(response.status).to.be.eql(520);
      expect(response.data).to.not.have.property('token');
    });
  });
  describe('Email errors', () => {
    it('should not allow authentication without email', async () => {
      let response = await login({
        password: password,
        tenant: tenant,
        acceptEula: 'true'
      });
      expect(response.status).to.be.eql(500);
      expect(response.data).to.not.have.property('token');
    });

    it('should not allow authentication of unknown email', async () => {
      let response = await login({
        email: 'unkown@sap.com',
        password: password,
        tenant: tenant,
        acceptEula: 'true'
      });
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });
  });

  describe('Tenant errors', () => {
    it('should not allow authentication without tenant', async () => {
      let response = await login({
        email: email,
        password: password,
        acceptEula: 'true'
      });
      expect(response.status).to.be.eql(500);
      expect(response.data).to.not.have.property('token');
    });

    it('should not allow authentication of unknown email', async () => {
      let response = await login({
        email: email,
        password: password,
        tenant: 'unkown',
        acceptEula: 'true'
      });
      expect(response.status).to.be.eql(550);
      expect(response.data).to.not.have.property('token');
    });
  });
});

