import { ImportedTag } from '../../../../types/Tag';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TagValidator extends SchemaValidator {
  private static instance: TagValidator|null = null;
  private importedTagCreation: Schema;

  private constructor() {
    super('TagValidator');
    this.importedTagCreation = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/imported-tag-create-req.json`, 'utf8'));
  }

  public static getInstance(): TagValidator {
    if (!TagValidator.instance) {
      TagValidator.instance = new TagValidator();
    }
    return TagValidator.instance;
  }

  validateImportedTagCreation(importedTag: ImportedTag): void {
    this.validate(this.importedTagCreation, importedTag);
  }
}
