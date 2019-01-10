const SchemaValidator = require('./SchemaValidator');
const connectionCreation = require('../schemas/connectors/connections/connection-creation');

class ConnectionValidator extends SchemaValidator {

  constructor() {
    if (!ConnectionValidator.instance) {
      super("TenantValidator");
      ConnectionValidator.instance = this;
    }

    return ConnectionValidator.instance;
  }

  validateConnectionCreation(content) {
    this.validate(connectionCreation, content);
  }

}

const instance = new ConnectionValidator();
Object.freeze(instance);

module.exports = instance;