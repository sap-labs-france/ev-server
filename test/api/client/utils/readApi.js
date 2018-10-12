const PageableApi = require('./PageableApi');

class ReadApi {

  constructor(baseApi) {
    this.baseApi = baseApi;
    this.pageableApi = new PageableApi(100, baseApi);
  }


  readById(path, id, expectations) {
    return this.baseApi.send({
      method: 'GET',
      path: path,
      query: {ID: id}
    }, expectations);
  }

  read(path, query, expectations) {
    return this.baseApi.send({
      method: 'GET',
      path: path,
      query: query
    }, expectations);
  }

  readAll(path, query, expectations) {
    let request = this.pageableApi;
    if (query.Limit || query.Skip) {
      request = this.baseApi;
    }
    return request.send({
      method: 'GET',
      path: path,
      query: query
    }, expectations);
  }
}

module.exports = ReadApi;