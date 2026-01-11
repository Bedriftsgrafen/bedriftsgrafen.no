"""add_konkursdato_and_formaal

Revision ID: d4ab2eb298ea
Revises: 362b91673eb9
Create Date: 2025-12-22 13:50:40.893970

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4ab2eb298ea'
down_revision: Union[str, Sequence[str], None] = '362b91673eb9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add new columns
    op.add_column('bedrifter', sa.Column('konkursdato', sa.Date(), nullable=True))
    op.add_column('bedrifter', sa.Column('vedtektsfestet_formaal', sa.Text(), nullable=True))
    
    # 2. Backfill data from JSONB
    # konkursdato is simple date string
    # vedtektsfestetFormaal is array of strings -> join with newline
    op.execute("""
        UPDATE bedrifter 
        SET 
            konkursdato = (data->>'konkursdato')::date,
            vedtektsfestet_formaal = (
                SELECT string_agg(elem, E'\n')
                FROM jsonb_array_elements_text(data->'vedtektsfestetFormaal') AS elem
            )
        WHERE data IS NOT NULL 
          AND (data ? 'konkursdato' OR data ? 'vedtektsfestetFormaal');
    """)
    
    # 3. Create index for filtering
    op.create_index('ix_bedrifter_konkursdato', 'bedrifter', ['konkursdato'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_bedrifter_konkursdato', table_name='bedrifter')
    op.drop_column('bedrifter', 'vedtektsfestet_formaal')
    op.drop_column('bedrifter', 'konkursdato')
