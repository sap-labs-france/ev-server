import { HttpTagsRequest } from '../../../../../types/requests/HttpUserRequest';
import Tag from '../../../../../types/Tag';
import UserToken from '../../../../../types/UserToken';
import Utils from '../../../../../utils/Utils';
import UtilsSecurity from './UtilsSecurity';
import sanitize from 'mongo-sanitize';

export default class TagSecurity {

  public static filterTagsRequest(request: any): HttpTagsRequest {
    const filteredRequest = {
      Search: sanitize(request.Search),
      UserID: sanitize(request.UserID),
      Issuer: Utils.objectHasProperty(request, 'Issuer') ? UtilsSecurity.filterBoolean(request.Issuer) : null,
      Active: Utils.objectHasProperty(request, 'Active') ? UtilsSecurity.filterBoolean(request.Active) : null
    } as HttpTagsRequest;
    UtilsSecurity.filterSkipAndLimit(request, filteredRequest);
    UtilsSecurity.filterSort(request, filteredRequest);
    return filteredRequest;
  }

  public static filterTagRequestByIDs(request: any): string[] {
    return request.tagsIDs.map(sanitize);
  }

  public static filterTagUpdateRequest(request: any, loggedUser: UserToken): Partial<Tag> {
    return TagSecurity.filterTagRequest(request, loggedUser);
  }

  public static filterTagCreateRequest(request: any, loggedUser: UserToken): Partial<Tag> {
    return TagSecurity.filterTagRequest(request, loggedUser);
  }

  public static filterTagRequest(tag: Tag, loggedUser: UserToken): Tag {
    let filteredTag: Tag;
    if (tag) {
      filteredTag = {
        id: sanitize(tag.id),
        description: sanitize(tag.description),
        active: UtilsSecurity.filterBoolean(tag.active),
        issuer: UtilsSecurity.filterBoolean(tag.issuer),
        default: UtilsSecurity.filterBoolean(tag.default),
        userID: sanitize(tag.userID)
      } as Tag;
    }
    return filteredTag;
  }

  public static filterTagRequestByID(request: any): string {
    return sanitize(request.ID);
  }
}
