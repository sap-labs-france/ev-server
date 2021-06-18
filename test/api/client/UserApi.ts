import CrudApi from './utils/CrudApi';
import { ServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class UserApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    const url = this.buildRestEndpointUrl(ServerRoute.REST_USER, { id });
    return super.readById(id, url);
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_USERS));
  }

  public async readAllInError(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/UsersInError');
  }

  public async create(data) {
    const url = this.buildRestEndpointUrl(ServerRoute.REST_USERS);
    return super.create(data, url);
  }

  public async update(data) {
    const url = this.buildRestEndpointUrl(ServerRoute.REST_USER, { id: data.id });
    return super.update(data, url);
  }

  public async delete(id) {
    const url = this.buildRestEndpointUrl(ServerRoute.REST_USER, { id });
    return super.delete(id, url);
  }

  public async getByEmail(email) {
    return this.readAll({ Search: email });
  }

  public async readTags(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/Tags');
  }

  public async readTag(id) {
    return super.read({ ID: id }, '/client/api/Tag');
  }

  public async updateTag(data) {
    return super.update(data, '/client/api/TagUpdate');
  }

  public async createTag(data) {
    return super.create(data, '/client/api/TagCreate');
  }

  public async deleteTag(id) {
    return super.delete(id, '/client/api/TagDelete');
  }

  public async exportTags(params) {
    return await super.read(params, '/client/api/TagsExport');
  }

  public async updateMobileToken(userID: string, mobileToken: string, mobileOS: string) {
    const url = this.buildRestEndpointUrl(ServerRoute.REST_USER_UPDATE_MOBILE_TOKEN, { id: userID });
    return await super.update({
      mobileToken, mobileOS
    }, url);
  }

  public async getImage(userID: string) {
    const url = this.buildRestEndpointUrl(ServerRoute.REST_USER_IMAGE, { id: userID });
    return await super.read({}, url);
  }
}
