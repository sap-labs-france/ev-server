import Schema from '../../types/validator/Schema';
import SchemaValidator from '../../validator/SchemaValidator';
import { TagLimit } from '../../types/Tag';
import fs from 'fs';
import global from '../../types/GlobalType';

export default class TagValidatorStorage extends SchemaValidator {
  private static instance: TagValidatorStorage | null = null;
  private tagLimitSave: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/storage/schemas/tag/tag-limit-save.json`, 'utf8'));

  private constructor() {
    super('TagValidatorStorage');
  }

  public static getInstance(): TagValidatorStorage {
    if (!TagValidatorStorage.instance) {
      TagValidatorStorage.instance = new TagValidatorStorage();
    }
    return TagValidatorStorage.instance;
  }

  public validateTagLimitSave(data: any): TagLimit {
    return this.validate(this.tagLimitSave, data, true);
  }
}
