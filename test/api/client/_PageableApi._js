const {expect} = require('chai');

/**
 * This class helps getting all elements of a pageable API. Otherwise, it will delegate calls to its base api.
 * For GET requests, if the response comply to a pageable format (count + result array), it will request all necessary
 * pages in order to return a unique consolidated response.
 */
class PageableApi {

  /**
   *
   * @param pageSize
   * @param baseApi
   */
  constructor(pageSize, baseApi) {
    this.pageSize = pageSize;
    this.baseApi = baseApi;
    this.url = baseApi.url;
  }

  /**
   * Sends a REST request.
   * @param requestConfig the request to send
   * @returns a Promise containing the response
   */
  async send(requestConfig) {
    if (requestConfig.method !== 'GET') {
      return this.baseApi.send(requestConfig)
    }
    const response = await this._getInitialRequest(requestConfig);
    if (this._isNotAPageableResponse(response)) {
      return response;
    }
    const totalCount = await this._getTotalCountOfElementToGet(response);
    const numberOfPagesToRequest = this._computeNumberOfPagesToRequest(totalCount);
    const responses = await this._requestAllPages(requestConfig, numberOfPagesToRequest);

    return this._buildAggregatedResponse(responses, totalCount);
  }

  async _getInitialRequest(requestConfig) {
    if (!requestConfig.params) {
      requestConfig.params = {};
    }
    requestConfig.params.Limit = 1;
    requestConfig.params.Skip = 0;
    const response = await this.baseApi.send(requestConfig);
    expect(response.status).to.equal(200);
    return response
  }

  async _getTotalCountOfElementToGet(response) {
    return response.data.count;
  }

  _computeNumberOfPagesToRequest(count) {
    let pages = Math.round(count / this.pageSize);
    if ((pages * this.pageSize) < count) {
      pages++;
    }
    return pages;
  }

  _extractAndAggregateResults(responses) {
    return responses.map(response => response.data.result).reduce((list, result) => list.concat(result), []);
  }

  _buildAggregatedResponse(responses, totalCount) {
    const response = {
      status: 200,
      data: {
        count: totalCount,
        result: this._extractAndAggregateResults(responses)
      }
    };
    return response;
  }

  _copyOfRequestWithPagingParameters(requestConfig, page) {
    const newRequestConfig = JSON.parse(JSON.stringify(requestConfig));
    newRequestConfig.params = {...newRequestConfig.params, ...{Limit: this.pageSize, Skip: this.pageSize * page}};
    return newRequestConfig;
  }

  _isNotAPageableResponse(response) {
    return !response.data.count
  }

  async _requestAllPages(requestConfig, numberOfPagesToRequest) {
    const promises = [...Array(numberOfPagesToRequest).keys()].map(async page => this.baseApi.send(this._copyOfRequestWithPagingParameters(requestConfig, page)));
    const responses = await Promise.all(promises);
    responses.forEach(response => {
        expect(response.status).to.equal(200);
        expect(response.data).to.have.property('count');
        expect(response.data).to.have.property('result');
      }
    );
    return responses;
  }


}

module.exports = PageableApi;