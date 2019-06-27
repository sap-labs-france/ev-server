import fs from 'fs';
import TSGlobal from '../../../types/GlobalType';
import SchemaValidator from './SchemaValidator';
declare const global: TSGlobal;

export default class ConnectionValidator extends SchemaValidator {
  private static instance: ConnectionValidator|null = null;
  public validate: any;
  private connectionCreation: any;

  private constructor() {
    super('TenantValidator');
    this.connectionCreation = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/schemas/connectors/connections/connection-creation.json`, 'utf8'));
  }

  public static getInstance(): ConnectionValidator {
    if (!ConnectionValidator.instance) {
      ConnectionValidator.instance = new ConnectionValidator();
    }
    return ConnectionValidator.instance;
  }

  validateConnectionCreation(content) {
    this.validate(this.connectionCreation, content);
  }
}

