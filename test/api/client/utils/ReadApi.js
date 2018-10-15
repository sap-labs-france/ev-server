const PageableApi = require('./PageableApi');

class ReadApi {

  constructor(baseApi) {
    this.baseApi = baseApi;
    this.pageableApi = new PageableApi(100, baseApi);
  }


  readById(path, id) {
    return this.baseApi.send({
      method: 'GET',
      url: path,
      params: {ID: id}
    });
  }

  read(path, query) {
    return this.baseApi.send({
      method: 'GET',
      url: path,
      params: query
    });
  }

  readAll(path, query) {
    let request = this.pageableApi;
    if (query.Limit || query.Skip) {
      request = this.baseApi;
    }
    return request.send({
      method: 'GET',
      url: path,
      params: query
    });
  }
}

module.exports = ReadApi;