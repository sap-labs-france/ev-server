export default interface HttpDatabaseRequest {
  Skip?: number;
  Limit?: number;
  OnlyRecordCount?: boolean;
  SortFields: any;
  ProjectFields?: any;
}

export interface HttpDatabaseProjectRequest {
  ProjectFields?: any;
}
