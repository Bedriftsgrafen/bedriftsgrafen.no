"""Add vedtektsfestet_formaal to search vector

Revision ID: f7a8b9c0d1e2
Revises: e5bc3fc409fb
Create Date: 2025-12-22 19:32:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, Sequence[str], None] = 'e5bc3fc409fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update the search vector trigger function to include vedtektsfestet_formaal
    op.execute("""
        CREATE OR REPLACE FUNCTION public.bedrifter_search_vector_update()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
        BEGIN
            NEW.search_vector := 
                setweight(to_tsvector('norwegian', COALESCE(NEW.navn, '')), 'A') ||
                setweight(to_tsvector('simple', COALESCE(NEW.orgnr, '')), 'B') ||
                setweight(to_tsvector('norwegian', COALESCE(NEW.vedtektsfestet_formaal, '')), 'C');
            RETURN NEW;
        END
        $function$;
    """)
    
    # Update the trigger to fire on vedtektsfestet_formaal changes too
    op.execute("""
        DROP TRIGGER IF EXISTS bedrifter_search_vector_trigger ON bedrifter;
    """)
    op.execute("""
        CREATE TRIGGER bedrifter_search_vector_trigger
        BEFORE INSERT OR UPDATE OF navn, orgnr, vedtektsfestet_formaal
        ON bedrifter
        FOR EACH ROW
        EXECUTE FUNCTION bedrifter_search_vector_update();
    """)
    
    # Rebuild search vectors for existing data (may take a few minutes)
    # Using batched update to avoid locking the entire table
    op.execute("""
        UPDATE bedrifter SET search_vector = 
            setweight(to_tsvector('norwegian', COALESCE(navn, '')), 'A') ||
            setweight(to_tsvector('simple', COALESCE(orgnr, '')), 'B') ||
            setweight(to_tsvector('norwegian', COALESCE(vedtektsfestet_formaal, '')), 'C')
        WHERE vedtektsfestet_formaal IS NOT NULL;
    """)


def downgrade() -> None:
    # Revert to original function (without vedtektsfestet_formaal)
    op.execute("""
        CREATE OR REPLACE FUNCTION public.bedrifter_search_vector_update()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
        BEGIN
            NEW.search_vector := 
                setweight(to_tsvector('norwegian', COALESCE(NEW.navn, '')), 'A') ||
                setweight(to_tsvector('simple', COALESCE(NEW.orgnr, '')), 'B');
            RETURN NEW;
        END
        $function$;
    """)
    
    # Revert trigger
    op.execute("""
        DROP TRIGGER IF EXISTS bedrifter_search_vector_trigger ON bedrifter;
    """)
    op.execute("""
        CREATE TRIGGER bedrifter_search_vector_trigger
        BEFORE INSERT OR UPDATE OF navn, orgnr
        ON bedrifter
        FOR EACH ROW
        EXECUTE FUNCTION bedrifter_search_vector_update();
    """)
