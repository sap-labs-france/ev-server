export default interface HttpDatabaseRequest {
  Skip: number;
  Limit: number;
  OnlyRecordCount?: boolean;
  SortFields: string[];
  SortDirs: string[]; // TODO: Deprecated: remote it
  Sort: any;
}
