import importlib.util
from contextlib import nullcontext
from pathlib import Path

MIGRATION_PATH = (
    Path(__file__).resolve().parents[3] / "alembic" / "versions" / "e3f4a5b6c7d8_add_financial_poll_retry_state.py"
)


class FakeContext:
    @staticmethod
    def autocommit_block():
        return nullcontext()


class FakeOp:
    def __init__(self):
        self.calls = []

    def add_column(self, table_name, column):
        self.calls.append(("add_column", table_name, column.name, column.nullable))

    def execute(self, statement):
        self.calls.append(("execute", statement))

    @staticmethod
    def get_context():
        return FakeContext()

    def drop_column(self, table_name, column_name):
        self.calls.append(("drop_column", table_name, column_name))


def _load_migration():
    spec = importlib.util.spec_from_file_location("financial_poll_retry_migration", MIGRATION_PATH)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_financial_poll_retry_migration_upgrade_and_downgrade(monkeypatch):
    migration = _load_migration()
    fake_op = FakeOp()
    monkeypatch.setattr(migration, "op", fake_op)

    migration.upgrade()
    migration.downgrade()

    assert ("add_column", "bedrifter", "financial_poll_failure_count", False) in fake_op.calls
    assert ("add_column", "bedrifter", "financial_poll_retry_after", True) in fake_op.calls
    assert any("CREATE INDEX CONCURRENTLY" in call[1] for call in fake_op.calls if call[0] == "execute")
    assert any("DROP INDEX CONCURRENTLY" in call[1] for call in fake_op.calls if call[0] == "execute")
    assert fake_op.calls[-2:] == [
        ("drop_column", "bedrifter", "financial_poll_retry_after"),
        ("drop_column", "bedrifter", "financial_poll_failure_count"),
    ]
