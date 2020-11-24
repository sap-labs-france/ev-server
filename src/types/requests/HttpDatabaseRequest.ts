export default interface HttpDatabaseRequest {
  Skip: number;
  Limit: number;
  OnlyRecordCount?: boolean;
  SortFields: string[];
  SortDirs: string[]; // TODO: Deprecated: remove it
  Sort: any;
}
