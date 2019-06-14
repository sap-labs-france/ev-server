export interface IncomingSearchable {
    Skip?: number;
    Limit?: number;
    OnlyRecordCount?: boolean;
    SortFields?: string[];
    SortDirs?: string[];
}
export interface FilteredSearchable {
    Skip: number;
    Limit: number;
    OnlyRecordCount?: boolean;
    Sort: any;
}