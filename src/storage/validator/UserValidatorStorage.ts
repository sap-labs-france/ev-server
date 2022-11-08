import Schema from '../../types/validator/Schema';
import SchemaValidator from '../../validator/SchemaValidator';
import { UserMobileData } from '../../types/User';
import fs from 'fs';
import global from '../../types/GlobalType';

export default class UserValidatorStorage extends SchemaValidator {
  private static instance: UserValidatorStorage | null = null;
  private userMobileDataSave: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/storage/schemas/user/user-mobile-data-save.json`, 'utf8'));

  private constructor() {
    super('UserValidatorStorage');
  }

  public static getInstance(): UserValidatorStorage {
    if (!UserValidatorStorage.instance) {
      UserValidatorStorage.instance = new UserValidatorStorage();
    }
    return UserValidatorStorage.instance;
  }

  public validateUserMobileDataSave(data: Record<string, any>): UserMobileData {
    return this.validate(this.userMobileDataSave, data, true);
  }
}
