import { HttpTagByVisualIDRequest, HttpTagRequest, HttpTagsDeleteByIDsRequest, HttpTagsDeleteByVisualIDRequest, HttpTagsDeleteByVisualIDsRequest, HttpTagsRequest } from '../../../../types/requests/HttpTagRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import Tag from '../../../../types/Tag';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TagValidator extends SchemaValidator {
  private static instance: TagValidator|null = null;
  private tagImportCreate: Schema;
  private tagCreate: Schema;
  private tagAssign: Schema;
  private tagUpdate: Schema;
  private tagVisualIDUpdate: Schema;
  private tagsGet: Schema;
  private tagGet: Schema;
  private tagVisualIDGet: Schema;
  private tagsDelete: Schema;
  private tagsUnassign: Schema;
  private tagUnassign: Schema;

  private constructor() {
    super('TagValidator');
    this.tagImportCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-import-create.json`, 'utf8'));
    this.tagCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-create.json`, 'utf8'));
    this.tagAssign = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-assign.json`, 'utf8'));
    this.tagUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-update.json`, 'utf8'));
    this.tagVisualIDUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-visual-id-update.json`, 'utf8'));
    this.tagsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tags-get.json`, 'utf8'));
    this.tagGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-get.json`, 'utf8'));
    this.tagVisualIDGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-visual-id-get.json`, 'utf8'));
    this.tagsDelete = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tags-delete.json`, 'utf8'));
    this.tagsUnassign = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tags-unassign.json`, 'utf8'));
    this.tagUnassign = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-unassign.json`, 'utf8'));
  }

  public static getInstance(): TagValidator {
    if (!TagValidator.instance) {
      TagValidator.instance = new TagValidator();
    }
    return TagValidator.instance;
  }

  public validateImportedTagCreateReq(data: unknown): void {
    return this.validate('validateImportedTagCreateReq', this.tagImportCreate, data);
  }

  public validateTagCreateReq(data: unknown): Tag {
    return this.validate('validateTagCreateReq', this.tagCreate, data);
  }

  public validateTagAssignReq(data: unknown): Tag {
    return this.validate('validateTagAssignReq', this.tagAssign, data);
  }

  public validateTagUpdateReq(data: unknown): Tag {
    return this.validate('validateTagUpdateReq', this.tagUpdate, data);
  }

  public validateTagVisualIDUpdateReq(data: unknown): Tag {
    return this.validate('validateTagVisualIDUpdateReq', this.tagVisualIDUpdate, data);
  }

  public validateTagsGetReq(data: unknown): HttpTagsRequest {
    return this.validate('validateTagsGetReq', this.tagsGet, data);
  }

  public validateTagByIDGetReq(data: unknown): HttpTagRequest {
    return this.validate('validateTagByIDGetReq', this.tagGet, data);
  }

  public validateTagVisualIDGetReq(data: unknown): HttpTagByVisualIDRequest {
    return this.validate('validateTagVisualIDGetReq', this.tagVisualIDGet, data);
  }

  public validateTagsDeleteReq(data: unknown): HttpTagsDeleteByIDsRequest {
    return this.validate('validateTagsDeleteReq', this.tagsDelete, data);
  }

  public validateTagsUnassignReq(data: unknown): HttpTagsDeleteByVisualIDsRequest {
    return this.validate('validateTagsUnassignReq', this.tagsUnassign, data);
  }

  public validateTagUnassignReq(data: unknown): HttpTagsDeleteByVisualIDRequest {
    return this.validate('validateTagUnassignReq', this.tagUnassign, data);
  }
}
