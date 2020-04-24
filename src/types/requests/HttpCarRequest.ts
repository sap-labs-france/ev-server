import HttpDatabaseRequest from './HttpDatabaseRequest';
export interface HttpCarCatalogsRequest extends HttpDatabaseRequest {
  Search?: string;
  CarMaker?: string;
}

export interface HttpCarMakersRequest extends HttpDatabaseRequest {
  Search?: string;
}

export interface HttpCarCatalogImagesRequest extends HttpDatabaseRequest {
  CarID: number;
}

export interface HttpCarCatalogByIDRequest {
  ID: number;
}
