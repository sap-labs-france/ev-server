import { HttpTagByVisualIDRequest, HttpTagRequest, HttpTagsRequest } from '../../../../types/requests/HttpTagRequest';
import Tag, { ImportedTag } from '../../../../types/Tag';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TagValidator extends SchemaValidator {
  private static instance: TagValidator|null = null;
  private importedTagCreation: Schema;
  private tagCreate: Schema;
  private tagAssign: Schema;
  private tagUpdate: Schema;
  private tagUpdateByVisualID: Schema;
  private tagsGet: Schema;
  private tagGet: Schema;
  private tagGetByVisualID: Schema;
  private tagsDelete: Schema;
  private tagsUnassign: Schema;
  private tagUnassign: Schema;

  private constructor() {
    super('TagValidator');
    this.importedTagCreation = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/imported-tag-create-req.json`, 'utf8'));
    this.tagCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-create.json`, 'utf8'));
    this.tagAssign = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-assign.json`, 'utf8'));
    this.tagUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-update.json`, 'utf8'));
    this.tagUpdateByVisualID = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-update-by-visual-id.json`, 'utf8'));
    this.tagsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tags-get.json`, 'utf8'));
    this.tagGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-get.json`, 'utf8'));
    this.tagGetByVisualID = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/tag/tag-get-by-visual-id.json`, 'utf8'));
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

  validateImportedTagCreation(importedTag: any): void {
    this.validate(this.importedTagCreation, importedTag);
  }

  validateTagCreate(tag: any): Tag {
    this.validate(this.tagCreate, tag);
    return tag;
  }

  validateTagAssign(tag: any): Tag {
    this.validate(this.tagAssign, tag);
    return tag;
  }

  validateTagUpdate(tag: any): Tag {
    this.validate(this.tagUpdate, tag);
    return tag;
  }

  validateTagUpdateByVisualID(tag: any): Tag {
    this.validate(this.tagUpdateByVisualID, tag);
    return tag;
  }

  validateTagsGet(data: any): HttpTagsRequest {
    this.validate(this.tagsGet, data);
    return data;
  }

  validateTagGetByID(data: any): HttpTagRequest {
    this.validate(this.tagGet, data);
    return data;
  }

  validateTagGetByVisualID(data: any): HttpTagByVisualIDRequest {
    this.validate(this.tagGetByVisualID, data);
    return data;
  }

  validateTagsDelete(data: any): { tagsIDs: string[] } {
    this.validate(this.tagsDelete, data);
    return data;
  }

  validateTagsUnassign(data: any): { visualIDs: string[] } {
    this.validate(this.tagsUnassign, data);
    return data;
  }

  validateTagUnassign(data: any): { visualID: string } {
    this.validate(this.tagUnassign, data);
    return data;
  }
}
