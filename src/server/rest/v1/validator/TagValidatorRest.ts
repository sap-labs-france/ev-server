import { HttpTagAssignRequest, HttpTagByVisualIDGetRequest, HttpTagByVisualIDUnassignRequest, HttpTagCreateRequest, HttpTagDeleteRequest, HttpTagGetRequest, HttpTagUpdateRequest, HttpTagsByVisualIDsUnassignRequest, HttpTagsDeleteRequest, HttpTagsGetRequest } from '../../../../types/requests/HttpTagRequest';

import { ImportedTag } from '../../../../types/Tag';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TagValidatorRest extends SchemaValidator {
  private static instance: TagValidatorRest|null = null;
  private tagImportCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-import-create.json`, 'utf8'));
  private tagCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-create.json`, 'utf8'));
  private tagAssign: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-assign.json`, 'utf8'));
  private tagUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-update.json`, 'utf8'));
  private tagVisualIDUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-visual-id-update.json`, 'utf8'));
  private tagsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tags-get.json`, 'utf8'));
  private tagGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-get.json`, 'utf8'));
  private tagDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-delete.json`, 'utf8'));
  private tagVisualIDGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-visual-id-get.json`, 'utf8'));
  private tagsDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tags-delete.json`, 'utf8'));
  private tagsByVisualIDsUnassign: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tags-by-visual-ids-unassign.json`, 'utf8'));
  private tagByVisualIDUnassign: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-by-visual-id-unassign.json`, 'utf8'));

  private constructor() {
    super('TagValidatorRest');
  }

  public static getInstance(): TagValidatorRest {
    if (!TagValidatorRest.instance) {
      TagValidatorRest.instance = new TagValidatorRest();
    }
    return TagValidatorRest.instance;
  }

  public validateImportedTagCreateReq(data: ImportedTag): void {
    return this.validate(this.tagImportCreate, data);
  }

  public validateTagCreateReq(data: Record<string, unknown>): HttpTagCreateRequest {
    return this.validate(this.tagCreate, data);
  }

  public validateTagAssignReq(data: Record<string, unknown>): HttpTagAssignRequest {
    return this.validate(this.tagAssign, data);
  }

  public validateTagUpdateReq(data: Record<string, unknown>): HttpTagUpdateRequest {
    return this.validate(this.tagUpdate, data);
  }

  public validateTagVisualIDUpdateReq(data: Record<string, unknown>): HttpTagUpdateRequest {
    return this.validate(this.tagVisualIDUpdate, data);
  }

  public validateTagsGetReq(data: Record<string, unknown>): HttpTagsGetRequest {
    return this.validate(this.tagsGet, data);
  }

  public validateTagGetReq(data: Record<string, unknown>): HttpTagGetRequest {
    return this.validate(this.tagGet, data);
  }

  public validateTagByVisualIDGetReq(data: Record<string, unknown>): HttpTagByVisualIDGetRequest {
    return this.validate(this.tagVisualIDGet, data);
  }

  public validateTagsDeleteReq(data: Record<string, unknown>): HttpTagsDeleteRequest {
    return this.validate(this.tagsDelete, data);
  }

  public validateTagDeleteReq(data: Record<string, unknown>): HttpTagDeleteRequest {
    return this.validate(this.tagDelete, data);
  }

  public validateTagsByVisualIDsUnassignReq(data: Record<string, unknown>): HttpTagsByVisualIDsUnassignRequest {
    return this.validate(this.tagsByVisualIDsUnassign, data);
  }

  public validateTagByVisualIDUnassignReq(data: Record<string, unknown>): HttpTagByVisualIDUnassignRequest {
    return this.validate(this.tagByVisualIDUnassign, data);
  }
}
