from fastapi import Query
from typing import Optional


class ListingParams:
    """Shared query-parameter convention for paginated, filterable, sortable lists.

    Mirrors the API conventions specified in TRD §3.5:
    - page/page_size for pagination
    - sort for ordering (field name, optional leading ``-`` for desc)
    - equipment / q for filtering (endpoint-specific meaning)
    """

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number (1-based)"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page"),
        sort: Optional[str] = Query(None, description="Sort field, e.g. 'created_at' or '-created_at'"),
        equipment: Optional[str] = Query(None, description="Filter by equipment class name"),
        q: Optional[str] = Query(None, description="Free-text filter"),
    ):
        self.page = page
        self.page_size = page_size
        self.sort = sort
        self.equipment = equipment
        self.q = q

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size
