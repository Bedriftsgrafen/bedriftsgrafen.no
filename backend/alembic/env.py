from logging.config import fileConfig
import asyncio
import logging
import os
from urllib.parse import quote_plus
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Import Base from models for autogenerate support
from models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata


def include_object(object, name, type_, reflected, compare_to):
    """
    Exclude materialized views from autogeneration to prevent DropTable/CreateTable cycles.
    """
    if type_ == "table" and name in [
        "industry_stats",
        "industry_subclass_stats",
        "county_stats",
        "municipality_stats",
        "latest_financials",
        "latest_accountings",
        "orgform_counts",
        "dashboard_stats",
        "system_state",
    ]:
        return False
    return True


# Load database URL from environment variable
def get_database_url() -> str:
    """Get database URL from environment variables.

    Note: Password is URL-encoded to handle special characters like @, :, ?, #
    Database host defaults to 'bedriftsgrafen-db' (Docker container name)
    """
    db_user = os.getenv("DATABASE_USER", "admin")
    raw_password = os.getenv("DATABASE_PASSWORD", "")
    db_password = quote_plus(raw_password) if raw_password else ""
    db_host = os.getenv("DATABASE_HOST", "bedriftsgrafen-db")
    db_port = os.getenv("DATABASE_PORT", "5432")
    db_name = os.getenv("DATABASE_NAME", "bedriftsgrafen")

    return f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    async def do_run_migrations():
        url = get_database_url()

        connectable = create_async_engine(
            url,
            poolclass=pool.NullPool,
        )

        async with connectable.connect() as connection:
            # Check if we should run without transaction (from command line -x)
            cmd_line_args = context.get_x_argument(as_dictionary=True)
            use_txn = cmd_line_args.get("commit_as_transaction", "True") != "False"

            if not use_txn:
                await connection.execution_options(isolation_level="AUTOCOMMIT")

            def do_configure(sync_connection):
                context.configure(
                    connection=sync_connection,
                    target_metadata=target_metadata,
                    include_object=include_object,
                    transactional_ddl=use_txn,
                )

            await connection.run_sync(do_configure)

            def run_migrations():
                if use_txn:
                    with context.begin_transaction():
                        context.run_migrations()
                else:
                    context.run_migrations()

            await connection.run_sync(lambda conn: run_migrations())

        await connectable.dispose()

    asyncio.run(do_run_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    try:
        run_migrations_online()
    except Exception as e:
        logger = logging.getLogger("alembic.env")
        logger.error(f"Migration failed: {e}")
        raise
