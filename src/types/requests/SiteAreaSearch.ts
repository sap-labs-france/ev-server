import FilteredSearchable from "./Searchable";

interface FilteredSiteAreaSearchBase extends FilteredSearchable {
    WithSite: boolean;
    WithChargeBoxes: boolean;
}

export interface HttpSiteAreaSearchRequest extends FilteredSiteAreaSearchBase {
    ID: string;
}

export interface HttpSiteAreasSearchRequest extends FilteredSiteAreaSearchBase {
    Search: string;
    SiteID: string;
    WithAvailableChargers: boolean;
}