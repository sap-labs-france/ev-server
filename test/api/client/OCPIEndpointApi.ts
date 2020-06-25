import CrudApi from './utils/CrudApi';
import TestConstants from './utils/TestConstants';

export default class OCPIEndpointApi extends CrudApi {
  public constructor(authenticatedApi) {
    super(authenticatedApi);
  }

  public async readById(id) {
    return super.readById(id, '/client/api/OcpiEndpoint');
  }

  public async readAll(params, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING) {
    return super.readAll(params, paging, ordering, '/client/api/OcpiEndpoints');
  }

  public async create(data) {
    return super.create(data, '/client/api/OcpiEndpointCreate');
  }

  public async update(data) {
    return super.update(data, '/client/api/OcpiEndpointUpdate');
  }

  public async delete(id) {
    return super.delete(id, '/client/api/OcpiEndpointDelete');
  }
}
