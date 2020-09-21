
export default class TestConstants {
  // Paging
  public static readonly PAGING_SIZE = 10;
  public static readonly DEFAULT_PAGING = { limit: TestConstants.PAGING_SIZE, skip: 0 };
  public static readonly DEFAULT_ORDERING = [];
  public static readonly UNLIMITED = Number.MAX_SAFE_INTEGER;
  public static readonly ADVANCED_PAGING = { limit: TestConstants.UNLIMITED, skip: 0 };

}
