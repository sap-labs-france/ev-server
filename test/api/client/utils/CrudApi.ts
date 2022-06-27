import AuthenticatedBaseApi from './AuthenticatedBaseApi';
import { RESTServerRoute } from '../../../../src/types/Server';
import TestConstants from './TestConstants';

export default class CrudApi {

  protected _authenticatedApi: AuthenticatedBaseApi;

  public constructor(authenticatedApi: AuthenticatedBaseApi) {
    this._authenticatedApi = authenticatedApi;
  }

  public setAutheticatedApi(authenticatedApi): void {
    this._authenticatedApi = authenticatedApi;
  }

  public async readById(id, path): Promise<any> {
    return this.read({ ID: id }, path);
  }

  public async read(params, path): Promise<any> {
    return this._authenticatedApi.send({
      method: 'GET',
      url: path,
      params
    });
  }

  public async readAll(params = {}, paging = TestConstants.DEFAULT_PAGING, ordering = TestConstants.DEFAULT_ORDERING, path): Promise<any> {
    // Build Paging
    this.buildPaging(paging, params);
    // Build Ordering
    this.buildOrdering(ordering, params);
    // Call
    return this._authenticatedApi.send({
      method: 'GET',
      url: path,
      params: params
    });
  }

  public async create(data, path): Promise<any> {
    return this._authenticatedApi.send({
      method: 'POST',
      url: path,
      data: data,
    });
  }

  public async update(data, path): Promise<any> {
    return this._authenticatedApi.send({
      method: 'PUT',
      url: path,
      data: data,
    });
  }

  public async delete(id, path): Promise<any> {
    return this._authenticatedApi.send({
      method: 'DELETE',
      url: path,
      params: {
        ID: id
      }
    });
  }

  public async patch(data, path): Promise<any> {
    return this._authenticatedApi.send({
      method: 'PATCH',
      url: path,
      data
    });
  }

  protected buildUtilRestEndpointUrl(urlPatternAsString: RESTServerRoute, params: { [name: string]: string | number | null } = {}): string {
    return this.buildRestEndpointUrl(urlPatternAsString, params, 'util');
  }

  protected buildRestEndpointUrl(urlPatternAsString: RESTServerRoute, params: { [name: string]: string | number | null } = {}, urlPrefix = 'api'): string {
    let resolvedUrlPattern = urlPatternAsString as string;
    for (const key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        resolvedUrlPattern = resolvedUrlPattern.replace(`:${key}`, encodeURIComponent(params[key]));
      }
    }
    return `/v1/${urlPrefix}/${resolvedUrlPattern}`;
  }

  private buildPaging(paging, queryString): void {
    // Limit
    if (paging?.limit) {
      queryString.Limit = paging.limit;
    } else {
      queryString.Limit = TestConstants.PAGING_SIZE;
    }
    // Skip
    if (paging?.skip) {
      queryString.Skip = paging.skip;
    }
  }

  // Build the ordering in the Queryparam
  private buildOrdering(ordering, queryString): void {
    if (ordering && ordering.length) {
      if (!queryString.SortFields) {
        Object.assign(queryString, { SortFields: [] });
      }
      // Set
      ordering.forEach((order) => {
        queryString.SortFields.push(order.field);
      });
    }
  }
}
