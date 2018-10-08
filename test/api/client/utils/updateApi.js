class UpdateApi {

  constructor(baseApi) {
    this.baseApi = baseApi;
  }

  update(path, payload, expectations) {
    return this.baseApi.send({
      method: 'PUT',
      path: path,
      payload: payload,
    }, expectations);
  }
}

module.exports = UpdateApi;