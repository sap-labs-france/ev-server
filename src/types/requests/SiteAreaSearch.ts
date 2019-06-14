import { IncomingSearchable, FilteredSearchable } from "./Searchable";

interface IncomingSiteAreaSearchBase extends IncomingSearchable {
    WithSite?: boolean;
    WithChargeBoxes?: boolean;
}
interface FilteredSiteAreaSearchBase extends IncomingSearchable {
    WithSite: boolean;
    WithChargeBoxes: boolean;
}

export interface IncomingSiteAreaSearch extends IncomingSiteAreaSearchBase {
    ID?: string;
}

export interface FilteredSiteAreaSearch extends FilteredSiteAreaSearchBase {
    ID: string;
}


export interface IncomingSiteAreasSearch extends IncomingSiteAreaSearchBase {
    Search?: string;
    SiteID?: string;
    WithAvailableChargers?: boolean;

}

export interface FilteredSiteAreasSearch extends FilteredSiteAreaSearchBase {
    Search: string;
    SiteID: string;
    WithAvailableChargers: boolean;
}