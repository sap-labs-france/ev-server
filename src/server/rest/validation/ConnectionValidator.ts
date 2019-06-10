import SchemaValidator from './SchemaValidator';
import connectionCreation from '../schemas/connectors/connections/connection-creation.json';

export default class ConnectionValidator extends SchemaValidator {
  public validate: any;

  private constructor() {
    super("TenantValidator");
  }

  private static instance: ConnectionValidator|null = null;
  public static getInstance(): ConnectionValidator {
    if(ConnectionValidator.instance == null) {
      ConnectionValidator.instance = new ConnectionValidator();
    }
    return ConnectionValidator.instance;
  }

  validateConnectionCreation(content) {
    this.validate(connectionCreation, content);
  }
}

