"""
Initial migration — creates all Chalo Kisaan tables.
Auto-generated via: alembic revision --autogenerate -m "initial"
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id",         sa.String(),  primary_key=True),
        sa.Column("phone",      sa.String(20),  nullable=True,  unique=True),
        sa.Column("email",      sa.String(255), nullable=True,  unique=True),
        sa.Column("name",       sa.String(200), nullable=True),
        sa.Column("language",   sa.String(20),  nullable=False, server_default="hindi"),
        sa.Column("is_active",  sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(),  nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(),  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_users_phone", "users", ["phone"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "projects",
        sa.Column("id",          sa.String(), primary_key=True),
        sa.Column("user_id",     sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name",        sa.String(300), nullable=False),
        sa.Column("description", sa.Text(),      nullable=True),
        sa.Column("status",      sa.String(30),  nullable=False, server_default="draft"),
        sa.Column("created_at",  sa.DateTime(),  nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at",  sa.DateTime(),  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_projects_user_id", "projects", ["user_id"])

    op.create_table(
        "farm_details",
        sa.Column("id",                      sa.String(),      primary_key=True),
        sa.Column("project_id",              sa.String(),      sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("location",                sa.String(500),   nullable=True),
        sa.Column("land_size",               sa.Float(),       nullable=True),
        sa.Column("soil_type",               sa.String(100),   nullable=True),
        sa.Column("water_source",            sa.String(100),   nullable=True),
        sa.Column("existing_infrastructure", sa.String(500),   nullable=True),
        sa.Column("budget",                  sa.BigInteger(),  nullable=True),
        sa.Column("biodiversity",            sa.String(200),   nullable=True),
        sa.Column("language",                sa.String(20),    nullable=False, server_default="hindi"),
        sa.Column("raw_voice_transcript",    sa.Text(),        nullable=True),
        sa.Column("created_at",              sa.DateTime(),    nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at",              sa.DateTime(),    nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "business_plans",
        sa.Column("id",                  sa.String(),    primary_key=True),
        sa.Column("project_id",          sa.String(),    sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id",             sa.String(),    sa.ForeignKey("users.id"),  nullable=False),
        sa.Column("raw_llm_response",    sa.Text(),      nullable=True),
        sa.Column("parsed_plan",         postgresql.JSON(), nullable=True),
        sa.Column("recommended_service", sa.String(300), nullable=True),
        sa.Column("tagline",             sa.String(500), nullable=True),
        sa.Column("suitability_score",   sa.Integer(),   nullable=True),
        sa.Column("language",            sa.String(20),  nullable=False, server_default="hindi"),
        sa.Column("status",              sa.String(30),  nullable=False, server_default="generating"),
        sa.Column("pdf_s3_key",          sa.String(500), nullable=True),
        sa.Column("created_at",          sa.DateTime(),  nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at",          sa.DateTime(),  nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_business_plans_project_id", "business_plans", ["project_id"])
    op.create_index("ix_business_plans_user_id",    "business_plans", ["user_id"])

    op.create_table(
        "farm_images",
        sa.Column("id",              sa.String(),      primary_key=True),
        sa.Column("project_id",      sa.String(),      sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("image_type",      sa.String(30),    nullable=False, server_default="original"),
        sa.Column("s3_bucket",       sa.String(200),   nullable=True),
        sa.Column("s3_key",          sa.String(500),   nullable=True),
        sa.Column("public_url",      sa.String(1000),  nullable=True),
        sa.Column("analysis_result", postgresql.JSON(), nullable=True),
        sa.Column("created_at",      sa.DateTime(),    nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_farm_images_project_id", "farm_images", ["project_id"])

    # Reference data tables (populated by seeds)
    op.create_table(
        "agri_zones",
        sa.Column("zone_id",              sa.Integer(),    primary_key=True, autoincrement=True),
        sa.Column("state",                sa.String(50),   nullable=True),
        sa.Column("district",             sa.String(100),  nullable=True),
        sa.Column("soil_type",            sa.String(50),   nullable=True),
        sa.Column("avg_rainfall_mm",      sa.Integer(),    nullable=True),
        sa.Column("primary_crops",        postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("agritourism_potential",sa.String(20),   nullable=True),
    )

    op.create_table(
        "government_schemes",
        sa.Column("scheme_id",          sa.Integer(),   primary_key=True, autoincrement=True),
        sa.Column("name",               sa.String(200), nullable=False),
        sa.Column("language_hi",        sa.Text(),      nullable=True),
        sa.Column("language_mr",        sa.Text(),      nullable=True),
        sa.Column("language_en",        sa.Text(),      nullable=True),
        sa.Column("min_land_acres",     sa.Float(),     nullable=True),
        sa.Column("max_income",         sa.BigInteger(),nullable=True),
        sa.Column("states",             postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("subsidy_percentage", sa.Integer(),   nullable=True),
        sa.Column("link",               sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("government_schemes")
    op.drop_table("agri_zones")
    op.drop_table("farm_images")
    op.drop_table("business_plans")
    op.drop_table("farm_details")
    op.drop_table("projects")
    op.drop_table("users")
