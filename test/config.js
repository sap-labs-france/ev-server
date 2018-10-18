const convict = require('convict');
const fs = require('fs');
// Define a schema
const config = convict({
  env: {
    doc: 'The test environment.',
    format: ['local', 'production'],
    default: 'local',
    env: 'NODE_ENV'
  },
  trace_logs: {
    doc: 'true to trace communication with servers',
    format: Boolean,
    default: 'false',
    env: 'TRACE_LOGS'
  },
  ocpp: {
    scheme: {
      doc: 'The OCPP server scheme.',
      format: ['http', 'https'],
      default: 'http',
      env: 'OCPP_SCHEME',
    },
    host: {
      doc: 'The OCPP server IP address to bind.',
      format: String,
      default: '127.0.0.1',
      env: 'OCPP_HOSTNAME'
    },
    port: {
      doc: 'The OCPP server port to bind.',
      format: 'port',
      default: 8000,
      env: 'OCPP_PORT',
      arg: 'ocpp_port'
    },
    logs: {
      doc: '"json"/"xml" to trace ocpp communication according to type, "none" to not trace them',
      format: ['json', 'xml', 'none'],
      default: 'none',
      env: 'OCPP_LOGS'
    },
  },
  server: {
    scheme: {
      doc: 'The SERVER server scheme.',
      format: ['http', 'https'],
      default: 'http',
      env: 'SERVER_SCHEME',
    },
    host: {
      doc: 'The SERVER server IP address to bind.',
      format: String,
      default: '127.0.0.1',
      env: 'SERVER_HOSTNAME'
    },
    port: {
      doc: 'The SERVER server port to bind.',
      format: 'port',
      default: 8081,
      env: 'SERVER_PORT',
      arg: 'server_port'
    },
    logs: {
      doc: '"json" to trace central server communication, "none" to not trace them',
      format: ['json', 'none'],
      default: 'none',
      env: 'SERVER_LOGS'
    }
  },
  admin: {
    username: {
      doc: 'The admin username',
      format: String,
      default: 'super.admin@ev.com',
      env: 'ADMIN_USERNAME'
    },
    password: {
      doc: 'The admin password',
      format: String,
      default: 'EQPQLwBIC0XgUgX@1Aa',
      env: 'ADMIN_PASSWORD'
    },
    tenant: {
      doc: 'The admin tenant',
      format: String,
      default: '',
      env: 'ADMIN_TENANT'
    }
  }
});

// Load environment dependent configuration
const env = config.get('env');
const fileName = './test/config/' + env + '.json';

if (fs.existsSync(fileName)) {
  config.loadFile(fileName);
}

// Perform validation
config.validate({allowed: 'strict'});

module.exports = config;
