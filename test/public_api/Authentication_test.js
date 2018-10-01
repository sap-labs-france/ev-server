/*
 * Copyright (c) 2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
const request = require('supertest');
const {expect} = require('chai');

const centralRestServer = request('http://127.0.0.1:8081');
//= =================== user API test ====================

describe('Authentication Service', () => {
  it('should authenticate a registered user', async () => {
    const message = await centralRestServer
      .post('/client/auth/Login')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send({
        email: 'demo.admin@sap.com',
        password: 'DeM*Us$r42',
        acceptEula: 'true'
      });
    expect(message).to.have.property('status');
    expect(message.status).to.equal(200);
    expect(message.text).to.exist
    let payload = JSON.parse(message.text);
    expect(payload.token).to.exist
  });
  describe('Password errors', () => {
    it('should not allow authentication of known user with wrong password', async () => {
      const message = await centralRestServer
        .post('/client/auth/Login')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          email: 'demo.admin@sap.com',
          password: 'another',
          acceptEula: 'true'
        });
      expect(message).to.have.property('status');
      expect(message.status).to.equal(550);
    });
    it('should not allow authentication without password', async () => {
      const message = await centralRestServer
        .post('/client/auth/Login')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          email: 'demo.admin@sap.com',
          acceptEula: 'true'
        });
      expect(message).to.have.property('status');
      expect(message.status).to.equal(500);
    });
  });
  describe('Eula errors', () => {
    it('should not allow authentication not accepting eula', async () => {
      const message = await centralRestServer
        .post('/client/auth/Login')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          email: 'demo.admin@sap.com',
          password: 'DeM*Us$r42',
          acceptEula: 'false'
        });
      expect(message).to.have.property('status');
      expect(message.status).to.equal(500);
    });

    it('should not allow authentication without eula', async () => {
      const message = await centralRestServer
        .post('/client/auth/Login')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          email: 'demo.admin@sap.com',
          password: 'DeM*Us$r42'
        });
      expect(message).to.have.property('status');
      expect(message.status).to.equal(520);
    });
  });
  describe('Email errors', () => {
    it('should not allow authentication without email', async () => {
      const message = await centralRestServer
        .post('/client/auth/Login')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          password: 'DeM*Us$r42',
          acceptEula: 'true'
        });
      expect(message).to.have.property('status');
      expect(message.status).to.equal(500);
    });
    it('should not allow authentication of unknown email', async () => {
      const message = await centralRestServer
        .post('/client/auth/Login')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          email: 'unkown@sap.com',
          password: 'DeM*Us$r42',
          acceptEula: 'true'
        });
      expect(message).to.have.property('status');
      expect(message.status).to.equal(550);
    });
  });
});

