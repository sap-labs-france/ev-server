const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const UserApi = require('./api/client/user')
const UserFactory = require('./factories/user')
const BaseApi = require('./api/client/utils/baseApi')
const AuthenticatedBaseApi = require('./api/client/utils/authenticatedBaseApi')
const config = require('./config');

describe('User tests', function() {
  this.timeout(10000);
  const authenticatedBaseApi = new AuthenticatedBaseApi(config.get('admin.user'), config.get('admin.password'), new BaseApi(`${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`));
  let userApi = null;

  before(async () => {
    userApi = new UserApi(authenticatedBaseApi);
  });

  it('should create a new user', async () => {
    await userApi.create(UserFactory.build(), (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.eql(
        {
          status: 'Success'
        }
      );
    });
  });

  it('should find a newly created user from list', async () => {
    const user = UserFactory.build();
    await userApi.readAll({Limit: 1}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
    });

    await userApi.create(user);

    await userApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      expect(response).to.have.property('result');
      expect(response.result).to.have.lengthOf(response.count);
      const actualUser = response.result.find((element) => element.email === user.email);
      expect(actualUser).to.be.a('object');
      expect(actualUser).to.containSubset({
        name: user.name,
        firstName: user.firstName,
        email: user.email,
        role: user.role,
        status: user.status,
        tagIDs: user.tagIDs
      });
      expect(actualUser).to.have.property('id');
    });
  });

  it('should find a specific user by id', async () => {
    const user = UserFactory.build();
    await userApi.create(user);
    let userId = null;
    await userApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      expect(response).to.have.property('result');
      userId = response.result.find((element) => element.email === user.email).id;
    });

    await userApi.readById(userId, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.containSubset({
        name: user.name,
        firstName: user.firstName,
        email: user.email,
        role: user.role
      });
    });
  });

});
