const WebSocket = require('ws');

class WSClient extends WebSocket {
  constructor(url, options) {
    super(url, options);
  }

  isConnectionOpen() {
    return this.readyState === WebSocket.OPEN;
  }
}

module.exports = WSClient;