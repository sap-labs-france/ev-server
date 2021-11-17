import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import { Setting } from '../../../../types/Setting';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class SettingValidator extends SchemaValidator {
  private static instance: SettingValidator | null = null;
  private settingCreate: Schema;

  private constructor() {
    super('SettingValidator');
    this.settingCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/setting/setting-create.json`, 'utf8'));
  }

  public static getInstance(): SettingValidator {
    if (!SettingValidator.instance) {
      SettingValidator.instance = new SettingValidator();
    }
    return SettingValidator.instance;
  }

  public validateSettingCreateReq(data: Record<string, unknown>): Setting {
    return this.validate(this.settingCreate, data);
  }
}
