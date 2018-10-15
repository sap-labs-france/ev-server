const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const UserApi = require('./api/client/user');
const UserFactory = require('./factories/user');
const BaseApi = require('./api/client/utils/baseApi');
const AuthenticatedBaseApi = require('./api/client/utils/authenticatedBaseApi');
const config = require('./config');

describe('User tests', function() {
  this.timeout(10000);
  const authenticatedBaseApi = new AuthenticatedBaseApi(config.get('admin.username'), config.get('admin.password'), new BaseApi(`${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`));
  let userApi = null;

  before(async () => {
    userApi = new UserApi(authenticatedBaseApi);
  });

  it('should create a new user', async () => {
    await userApi.create(UserFactory.build(), (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      expect(response).to.have.property('id');
      expect(response.id).to.match(/^[a-f0-9]+$/);
    });
  });

  it('should find a newly created user from list', async () => {
    const user = UserFactory.build();

    await userApi.create(user, ((message, response) => {
      user.id = response.id;
    }));

    delete user.acceptEula;
    delete user.captcha;
    delete user.passwords;

    await userApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      expect(response).to.have.property('result');
      expect(response.result).to.have.lengthOf(response.count);
      const actualUser = response.result.find((element) => element.email === user.email);
      expect(actualUser).to.be.a('object');
      expect(actualUser).to.containSubset(user);
    });
  });

  it('should find a specific user by id', async () => {
    const user = UserFactory.build();
    await userApi.create(user, ((message, response) => {
      user.id = response.id;
    }));

    delete user.acceptEula;
    delete user.captcha;
    delete user.passwords;

    await userApi.readById(user.id, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.containSubset(user);
    });
  });

});
