const Superagent = require('superagent');
const config = require('../../../config');

class BaseApi {

  constructor(url) {
    this.url = url;
  }

  async send(data, expectation) {
    let request = null;

    switch (data.method) {
      case 'POST':
        request = Superagent.post(this.url + data.path);
        break;
      case 'GET':
        request = Superagent.get(this.url + data.path);
        break;
      case 'PUT':
        request = Superagent.put(this.url + data.path);
        break;
      case 'DELETE':
        request = Superagent.delete(this.url + data.path);
        break;
    }

    if (data.headers.Accept == null) {
      data.headers.Accept = 'application/json';
    }
    if ((data.headers['content-type'] == null || data.headers['Content-Type'] == null) && data.method !== 'GET') {
      data.headers['content-type'] = 'application/json';
    }

    Object.entries(data.headers).forEach(entry => request = request.set(entry[0], entry[1]));

    request = request.query(data.query);

    if (data.payload) {
      request = request.send(data.payload);
    }
    let message = null;
    try {
      message = await request.then();
    } catch (error) {
      message = error.response;
    }
    if (config.get('trace_logs')) {
      console.log(JSON.stringify(message, null, 2));
    }
    let response = null;
    if (data.headers.Accept === 'application/json') {
      response = JSON.parse(message.text);
      message['response'] = response;
    }
    if (expectation) {
      await expectation(message, response);
    }
    return message;
  }
}

module.exports = BaseApi;