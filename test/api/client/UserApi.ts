import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import CrudApi from './utils/CrudApi';
import { RESTServerRoute } from '../../../src/types/Server';
import TestConstants from './utils/TestConstants';

export default class UserApi extends CrudApi {
  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    const url = this.buildRestEndpointUrl(RESTServerRoute.REST_USER, { id });
    return super.readById(id, url);
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_USERS));
  }

  public async readAllInError(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, this.buildRestEndpointUrl(RESTServerRoute.REST_USERS_IN_ERROR));
  }

  public async create(data) {
    const url = this.buildRestEndpointUrl(RESTServerRoute.REST_USERS);
    return super.create(data, url);
  }

  public async update(data) {
    const url = this.buildRestEndpointUrl(RESTServerRoute.REST_USER, { id: data.id });
    return super.update(data, url);
  }

  public async delete(id) {
    const url = this.buildRestEndpointUrl(RESTServerRoute.REST_USER, { id });
    return super.delete(id, url);
  }

  public async getByEmail(email) {
    return this.readAll({ Search: email });
  }

  public async exportUsers(params) {
    return super.read(params, this.buildRestEndpointUrl(RESTServerRoute.REST_USERS_EXPORT));
  }

  public async updateMobileToken(userID: string, mobileToken: string, mobileOS: string) {
    const url = this.buildRestEndpointUrl(RESTServerRoute.REST_USER_UPDATE_MOBILE_TOKEN, { id: userID });
    return super.update({
      mobileToken, mobileOS
    }, url);
  }

  public async getImage(userID: string) {
    const url = this.buildRestEndpointUrl(RESTServerRoute.REST_USER_IMAGE, { id: userID });
    return super.read({}, url);
  }

  public async getDefaultTagCar(userID: string) {
    const url = this.buildRestEndpointUrl(RESTServerRoute.REST_USER_DEFAULT_TAG_CAR, { });
    return super.read({ UserID: userID }, url);
  }

  public async getUserSessionContext(params) {
    const url = this.buildRestEndpointUrl(RESTServerRoute.REST_USER_SESSION_CONTEXT, { id: params.userID });
    return super.read({ ChargingStationID: params.chargingStationID, ConnectorID: params.connectorID }, url);
  }
}
