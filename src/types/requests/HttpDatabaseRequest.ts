export default interface HttpDatabaseRequest {
  Skip?: number;
  Limit?: number;
  OnlyRecordCount?: boolean;
  SortFields: any;
  ProjectFields?: string[];
}

export interface HttpDatabaseProjectRequest {
  ProjectFields?: string[];
}
