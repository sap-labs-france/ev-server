const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const BaseApi = require('./api/client/utils/BaseApi');
const config = require('./config');

const email = config.get('admin.username');
const password = config.get('admin.password');
const baseApi = new BaseApi(`${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`);
const login = (payload, expectations) => {
  return baseApi.send({
    method: 'POST',
    path: '/client/auth/Login',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    payload: payload
  }, expectations)
};


describe('Authentication Service', () => {

  it('should authenticate a registered user', async () => {
    await login({
      email: email,
      password: password,
      acceptEula: 'true'
    }, (message, response) => {
      expect(message.status).to.be.eql(200);
      expect(response).to.have.property('token');
      expect(response.token).to.be.a('string');
    });
  });

  describe('Password errors', () => {
    it('should not allow authentication of known user with wrong password', async () => {
      await login({
        email: email,
        password: 'another',
        acceptEula: 'true'
      }, (message, response) => {
        expect(message.status).to.be.eql(550);
        expect(response).to.not.have.property('token');
      });
    });
    it('should not allow authentication without password', async () => {
      await login({
        email: email,
        acceptEula: 'true'
      }, (message, response) => {
        expect(message.status).to.be.eql(500);
        expect(response).to.not.have.property('token');
      });

    });
  });
  describe('Eula errors', () => {
    it('should not allow authentication not accepting eula', async () => {
      await login({
        email: email,
        password: password,
        acceptEula: false
      }, (message, response) => {
        expect(message.status).to.be.eql(520);
        expect(response).to.not.have.property('token');
      });
    });

    it('should not allow authentication without eula', async () => {
      await login({
        email: email,
        password: password,
      }, (message, response) => {
        expect(message.status).to.be.eql(520);
        expect(response).to.not.have.property('token');
      });
    });
  });
  describe('Email errors', () => {
    it('should not allow authentication without email', async () => {
      await login({
        password: password,
        acceptEula: 'true'
      }, (message, response) => {
        expect(message.status).to.be.eql(500);
        expect(response).to.not.have.property('token');
      });
    });

    it('should not allow authentication of unknown email', async () => {
      await login({
        email: 'unkown@sap.com',
        password: password,
        acceptEula: 'true'
      }, (message, response) => {
        expect(message.status).to.be.eql(550);
        expect(response).to.not.have.property('token');
      });
    });

  });
});

