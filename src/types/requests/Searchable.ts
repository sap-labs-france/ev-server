export default interface FilteredSearchable {
    Skip: number;
    Limit: number;
    OnlyRecordCount?: boolean;
    SortFields: string[];
    SortDirs: string[];
    Sort: any;
}