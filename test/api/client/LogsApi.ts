import { RESTServerRoute } from '../../../src/types/Server';
import CrudApi from './utils/CrudApi';
import TestConstants from './utils/TestConstants';

export default class LogsApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.readById(id, this.buildRestEndpointUrl(RESTServerRoute.REST_LOG, { id }));
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_LOGS));
  }
}
