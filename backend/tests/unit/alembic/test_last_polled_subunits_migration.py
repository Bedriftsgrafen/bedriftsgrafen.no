import importlib.util
from pathlib import Path

MIGRATION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "d2e3f4a5b6c7_add_last_polled_subunits_to_bedrifter.py"
)


class FakeOp:
    def __init__(self):
        self.calls = []

    def f(self, name):
        return name

    def add_column(self, table_name, column):
        self.calls.append(("add_column", table_name, column.name, column.type.timezone))

    def execute(self, statement):
        self.calls.append(("execute", statement))

    def drop_column(self, table_name, column_name):
        self.calls.append(("drop_column", table_name, column_name))


def _load_migration():
    spec = importlib.util.spec_from_file_location("last_polled_subunits_migration", MIGRATION_PATH)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_last_polled_subunits_migration_upgrade_and_downgrade(monkeypatch):
    migration = _load_migration()
    fake_op = FakeOp()
    monkeypatch.setattr(migration, "op", fake_op)

    migration.upgrade()
    migration.downgrade()

    assert fake_op.calls == [
        ("execute", "SET LOCAL lock_timeout = '5s'"),
        ("add_column", "bedrifter", "last_polled_subunits", True),
        ("execute", "SET LOCAL lock_timeout = '5s'"),
        ("drop_column", "bedrifter", "last_polled_subunits"),
    ]
