import Constants from './utils/Constants';
import CrudApi from './utils/CrudApi';

export default class OCPIEndpointApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public readById(id) {
    return super.readById(id, '/client/api/OcpiEndpoint');
  }

  public readAll(params, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/OcpiEndpoints');
  }

  public create(data) {
    return super.create(data, '/client/api/OcpiEndpointCreate');
  }

  public update(data) {
    return super.update(data, '/client/api/OcpiEndpointUpdate');
  }

  public delete(id) {
    return super.delete(id, '/client/api/OcpiEndpointDelete');
  }
}
