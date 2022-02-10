import { HttpTagByVisualIDRequest, HttpTagRequest, HttpTagsDeleteByIDsRequest, HttpTagsDeleteByVisualIDRequest, HttpTagsDeleteByVisualIDsRequest, HttpTagsRequest } from '../../../../types/requests/HttpTagRequest';
import Tag, { ImportedTag } from '../../../../types/Tag';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TagValidator extends SchemaValidator {
  private static instance: TagValidator|null = null;
  private tagImportCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-import-create.json`, 'utf8'));
  private tagCreate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-create.json`, 'utf8'));
  private tagAssign: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-assign.json`, 'utf8'));
  private tagUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-update.json`, 'utf8'));
  private tagVisualIDUpdate: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-visual-id-update.json`, 'utf8'));
  private tagsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tags-get.json`, 'utf8'));
  private tagGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-get.json`, 'utf8'));
  private tagVisualIDGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-visual-id-get.json`, 'utf8'));
  private tagsDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tags-delete.json`, 'utf8'));
  private tagsUnassign: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tags-unassign.json`, 'utf8'));
  private tagUnassign: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-unassign.json`, 'utf8'));

  private constructor() {
    super('TagValidator');
  }

  public static getInstance(): TagValidator {
    if (!TagValidator.instance) {
      TagValidator.instance = new TagValidator();
    }
    return TagValidator.instance;
  }

  public validateImportedTagCreateReq(data: ImportedTag): void {
    return this.validate(this.tagImportCreate, data);
  }

  public validateTagCreateReq(data: Record<string, unknown>): Tag {
    return this.validate(this.tagCreate, data);
  }

  public validateTagAssignReq(data: Record<string, unknown>): Tag {
    return this.validate(this.tagAssign, data);
  }

  public validateTagUpdateReq(data: Record<string, unknown>): Tag {
    return this.validate(this.tagUpdate, data);
  }

  public validateTagVisualIDUpdateReq(data: Record<string, unknown>): Tag {
    return this.validate(this.tagVisualIDUpdate, data);
  }

  public validateTagsGetReq(data: Record<string, unknown>): HttpTagsRequest {
    return this.validate(this.tagsGet, data);
  }

  public validateTagByIDGetReq(data: Record<string, unknown>): HttpTagRequest {
    return this.validate(this.tagGet, data);
  }

  public validateTagVisualIDGetReq(data: Record<string, unknown>): HttpTagByVisualIDRequest {
    return this.validate(this.tagVisualIDGet, data);
  }

  public validateTagsDeleteReq(data: Record<string, unknown>): HttpTagsDeleteByIDsRequest {
    return this.validate(this.tagsDelete, data);
  }

  public validateTagsUnassignReq(data: Record<string, unknown>): HttpTagsDeleteByVisualIDsRequest {
    return this.validate(this.tagsUnassign, data);
  }

  public validateTagUnassignReq(data: Record<string, unknown>): HttpTagsDeleteByVisualIDRequest {
    return this.validate(this.tagUnassign, data);
  }
}
