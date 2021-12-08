import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { ServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class TagApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readTags(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(ServerRoute.REST_TAGS));
  }

  public async readTag(id: string) {
    return super.read({ ID: id }, this.buildRestEndpointUrl(ServerRoute.REST_TAG, { id }));
  }

  public async updateTag(data) {
    return super.update(data, this.buildRestEndpointUrl(ServerRoute.REST_TAG, { id: data.id }));
  }

  public async assignTag(params?) {
    return await super.update(params, this.buildRestEndpointUrl(ServerRoute.REST_TAG_ASSIGN, { id: params.id }));
  }

  public async updateTagByVisualID(params?) {
    return await super.update(params, this.buildRestEndpointUrl(ServerRoute.REST_TAGS));
  }

  public async unassignTag(params?) {
    return await super.update(params, this.buildRestEndpointUrl(ServerRoute.REST_TAG_UNASSIGN));
  }

  public async readTagByVisualID(visualID: string) {
    return super.read({ VisualID: visualID }, this.buildRestEndpointUrl(ServerRoute.REST_TAGS));
  }

  public async createTag(data) {
    return super.create(data, this.buildRestEndpointUrl(ServerRoute.REST_TAGS));
  }

  public async deleteTag(id: string) {
    return super.delete(id, this.buildRestEndpointUrl(ServerRoute.REST_TAG, { id }));
  }

  public async exportTags(params) {
    return await super.read(params, this.buildRestEndpointUrl(ServerRoute.REST_TAGS_EXPORT));
  }
}
