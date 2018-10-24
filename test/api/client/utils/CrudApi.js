const Constants = require('./Constants')

/**
 * CRUD API (Create Read Update Delete)
 *
 * @class CrudApi
 */
class CrudApi {

  /**
   * Creates an instance of CrudApi.
   * Only deals with secure connection
   * 
   * @param {*} this.authenticatedApi The authenticated API to perform the requests
   * @memberof CrudApi
   */
  constructor(authenticatedApi) {
    this.authenticatedApi = authenticatedApi;
  }

  /**
   * Request one object from the backend with its ID
   *
   * @param {*} path The URL path
   * @param {*} id The ID of the object to request
   * @returns The HTTP response
   * @memberof CrudApi
   */
  readById(path, id) {
    // Execute
    return this.read(path, { ID: id });
  }
  
  /**
   * Generic Read
   *
   * @param {*} path The URL path
   * @param {*} params
   * @returns The HTTP response
   * @memberof CrudApi
   */
  read(path, params) {
    return this.authenticatedApi.send({
      method: 'GET',
      url: path,
      params
    });
  }

  /**
   * Request a list of objects from the backend
   *
   * @param {*} path The URL path
   * @param {*} params The request parameters (filters)
   * @param {*} [paging=Constants.DEFAULT_PAGING] The paging params
   * @param {*} [ordering=Constants.DEFAULT_ORDERING] The ordering params
   * @returns The HTTP response
   * @memberof CrudApi
   */
  readAll(path, params={}, paging = Constants.DEFAULT_PAGING, ordering = Constants.DEFAULT_ORDERING) {
    // Build Paging
    this._buildPaging(paging, params);
    // Build Ordering
    this._buildOrdering(ordering, params);
    // Call
    return this.authenticatedApi.send({
      method: 'GET',
      url: path,
      params: params
    });
  }

  /**
   * Create an object in the backend
   *
   * @param {*} path The URL path
   * @param {*} data The object to create
   * @returns The HTTP response
   * @memberof CrudApi
   */
  create(path, data) {
    return this.authenticatedApi.send({
      method: 'POST',
      url: path,
      data: data,
    });
  }

  /**
   * Update an object in the backend
   *
   * @param {*} path The URL path
   * @param {*} data The object to update
   * @returns The HTTP response
   * @memberof CrudApi
   */
  update(path, data) {
    return this.authenticatedApi.send({
      method: 'PUT',
      url: path,
      data: data,
    });
  }

  /**
   * Delete an object in the backend
   *
   * @param {*} path The URL path
   * @param {*} id The ID of the object to delete
   * @returns
   * @memberof CrudApi
   */
  delete(path, id) {
    return this.authenticatedApi.send({
      method: 'DELETE',
      url: path,
      params: {
        ID: id
      }
    });
  }

  // Build the paging in the Queryparam
  _buildPaging(paging, queryString) {
    // Check
    if (paging) {
      // Limit
      if (paging.limit) {
        queryString.Limit = paging.limit;
      }
      // Skip
      if (paging.skip) {
        queryString.Skip = paging.skip;
      }
    }
  }

  // Build the ordering in the Queryparam
  _buildOrdering(ordering, queryString) {
    // Check
    if (ordering && ordering.length) {
      if (!queryString.SortFields) {
        queryString.SortFields = [];
        queryString.SortDirs = [];
      }
      // Set
      ordering.forEach((order) => {
        queryString.SortFields.push(order.field);
        queryString.SortDirs.push(order.direction);
      });
    }
  }
}

module.exports = CrudApi;