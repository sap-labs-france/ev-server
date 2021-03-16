import { ImportedTag } from '../../../../types/Tag';
import Schema from './Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TagValidator extends SchemaValidator {
  private static instance: TagValidator|null = null;
  private tagCreation: Schema;

  private constructor() {
    super('TagValidator');
    this.tagCreation = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-create-req.json`, 'utf8'));
  }

  public static getInstance(): TagValidator {
    if (!TagValidator.instance) {
      TagValidator.instance = new TagValidator();
    }
    return TagValidator.instance;
  }

  validateTagCreation(importedTag: ImportedTag): void {
    this.validate(this.tagCreation, importedTag);
  }
}
