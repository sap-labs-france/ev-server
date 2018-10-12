const {expect} = require('chai');

class PageableApi {

  constructor(pageSize, baseApi) {
    this.pageSize = pageSize;
    this.baseApi = baseApi;
    this.url = baseApi.url;
  }

  async send(data, expectations) {
    let count = 0;
    data.query.Limit = 1;
    data.query.Skip = 0;
    await this.baseApi.send(data, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      count = response.count;
    });
    let pages = Math.round(count / this.pageSize);

    if ((pages * this.pageSize) < count) {
      pages++;
    }

    const fullResponse = {
      count: count,
      result: []
    };

    const promises = [...Array(pages).keys()].map(page => {
      const innerData = JSON.parse(JSON.stringify(data));
      innerData.query = {...innerData.query, ...{Limit: this.pageSize, Skip: this.pageSize * page}};
      return this.baseApi.send(innerData, (message, response) => {
        expect(message.status).to.equal(200);
        expect(response).to.have.property('count');
        expect(response).to.have.property('result');
      });
    });

    fullResponse.result = (await Promise.all(promises)).map(message => message.body.result).reduce((list, result) => list.concat(result), []);
    await expectations({status: 200}, fullResponse);
  }

}

module.exports = PageableApi