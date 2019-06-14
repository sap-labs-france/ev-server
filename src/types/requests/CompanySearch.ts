export interface IncomingCompanySearch {

    Search: string;
    WithSites?: boolean;
    Skip?: number;
    Limit?: number;
    OnlyRecordCount?: boolean;
    SortFields?: string[];
    SortDirs?: string[];

}

export interface FilteredCompanySearch {

    Search: string;
    WithSites: boolean;
    Skip: number;
    Limit: number;
    OnlyRecordCount?: boolean;
    Sort: any;

}