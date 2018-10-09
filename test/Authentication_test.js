const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const BaseApi = require('./api/client/utils/baseApi');
const config = require('./config');


describe('Authentication Service', () => {
  const baseApi = new BaseApi(`${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`);

  it('should authenticate a registered user', async () => {
    await baseApi.send({
      method: 'POST',
      path: '/client/auth/Login',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: {
        email: config.get('admin.username'),
        password: config.get('admin.password'),
        acceptEula: 'true'
      }
    }, (message, response) => {
      expect(message).to.containSubset(
        {
          status: 200
        }
      );
      expect(response.token).to.exist
    });
  });
  describe('Password errors', () => {

    it('should not allow authentication of known user with wrong password', async () => {
      await baseApi.send({
        method: 'POST',
        path: '/client/auth/Login',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: {
          email: config.get('admin.username'),
          password: 'another',
          acceptEula: 'true'
        }
      }, (message, response) => {
        expect(message).to.containSubset(
          {
            status: 550
          }
        );
      });
    });
    it('should not allow authentication without password', async () => {
      await baseApi.send({
        method: 'POST',
        path: '/client/auth/Login',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: {
          email: config.get('admin.username'),
          acceptEula: 'true'
        }
      }, (message, response) => {
        expect(message).to.containSubset(
          {
            status: 500
          }
        );
      });

    });
  });
  describe('Eula errors', () => {
    it('should not allow authentication not accepting eula', async () => {
      await baseApi.send({
        method: 'POST',
        path: '/client/auth/Login',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: {
          email: config.get('admin.username'),
          password: config.get('admin.password'),
          acceptEula: false
        }
      }, (message, response) => {
        expect(message).to.containSubset(
          {
            status: 520
          }
        );
      });
    });

    it('should not allow authentication without eula', async () => {
      await baseApi.send({
        method: 'POST',
        path: '/client/auth/Login',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: {
          email: config.get('admin.username'),
        password: config.get('admin.password'),
        }
      }, (message, response) => {
        expect(message).to.containSubset(
          {
            status: 520
          }
        );
      });
    });
  });
  describe('Email errors', () => {
    it('should not allow authentication without email', async () => {
      await baseApi.send({
        method: 'POST',
        path: '/client/auth/Login',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: {
          password: 'DeM*Us$r42',
          acceptEula: 'true'
        }
      }, (message, response) => {
        expect(message).to.containSubset(
          {
            status: 500
          }
        );
      });
    });

    it('should not allow authentication of unknown email', async () => {
      await baseApi.send({
        method: 'POST',
        path: '/client/auth/Login',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: {
          email: 'unkown@sap.com',
          password: 'DeM*Us$r42',
          acceptEula: 'true'
        }
      }, (message, response) => {
        expect(message).to.containSubset(
          {
            status: 550
          }
        );
      });
    });

  });
});

