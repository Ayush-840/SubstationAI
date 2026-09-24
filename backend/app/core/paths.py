"""Central path resolution so the app works on the host repo layout and inside Docker."""
from pathlib import Path


def _find_dir(candidates: list[Path]) -> Path:
    for c in candidates:
        if c.is_dir():
            return c
    # fall back to creating the first option
    candidates[0].mkdir(parents=True, exist_ok=True)
    return candidates[0]


def _repo_root() -> Path:
    # backend/app/core/paths.py -> parents[2] = backend, parents[3] = repo root
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "data" / "catalog").is_dir() or (parent / "PRD.md").exists():
            return parent
    return here.parents[2]


REPO_ROOT = _repo_root()

# data/catalog: repo layout first, then Docker /app/data layout
CATALOG_DIR = _find_dir([
    REPO_ROOT / "data" / "catalog",
    Path("/app/data/catalog"),
    Path("data/catalog").resolve(),
])

# data/raw_docs
RAW_DOCS_DIR = _find_dir([
    REPO_ROOT / "data" / "raw_docs",
    Path("/app/data/raw_docs"),
    Path("data/raw_docs").resolve(),
])

# data root (chroma lives under data/chroma)
DATA_DIR = _find_dir([
    REPO_ROOT / "data",
    Path("/app/data"),
    Path("data").resolve(),
])
