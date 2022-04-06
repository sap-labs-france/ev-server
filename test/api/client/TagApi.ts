import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { RESTServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class TagApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readTags(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_TAGS));
  }

  public async readTag(id: string) {
    return super.read({ ID: id }, this.buildRestEndpointUrl(RESTServerRoute.REST_TAG, { id }));
  }

  public async updateTag(data) {
    return super.update(data, this.buildRestEndpointUrl(RESTServerRoute.REST_TAG, { id: data.id }));
  }

  public async assignTag(params?) {
    return super.update(params, this.buildRestEndpointUrl(RESTServerRoute.REST_TAG_ASSIGN, { id: params.visualID }));
  }

  public async updateTagByVisualID(params?) {
    return super.update(params, this.buildRestEndpointUrl(RESTServerRoute.REST_TAG, { id: params.visualID }));
  }

  public async unassignTag(params?) {
    return super.update(params, this.buildRestEndpointUrl(RESTServerRoute.REST_TAG_UNASSIGN, { id: params.visualID }));
  }

  public async readTagByVisualID(visualID: string) {
    return super.read({ VisualID: visualID }, this.buildRestEndpointUrl(RESTServerRoute.REST_TAGS));
  }

  public async createTag(data) {
    return super.create(data, this.buildRestEndpointUrl(RESTServerRoute.REST_TAGS));
  }

  public async deleteTag(id: string) {
    return super.delete(id, this.buildRestEndpointUrl(RESTServerRoute.REST_TAG, { id }));
  }

  public async exportTags(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_TAGS_EXPORT));
  }
}
