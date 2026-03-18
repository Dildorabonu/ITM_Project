"""Full ERD schema: users, departments, contracts, tech_processes, tech_steps,
   materials, stock_in, stock_out, tech_process_materials, tasks, notifications

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-03-18 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Drop old tables (order: FKs first) ────────────────────────────────────
    op.execute("DROP TABLE IF EXISTS tech_process_materials CASCADE")
    op.execute("DROP TABLE IF EXISTS tech_steps CASCADE")
    op.execute("DROP TABLE IF EXISTS tech_processes CASCADE")
    op.execute("DROP TABLE IF EXISTS stock_out CASCADE")
    op.execute("DROP TABLE IF EXISTS stock_in CASCADE")
    op.execute("DROP TABLE IF EXISTS materials CASCADE")
    op.execute("DROP TABLE IF EXISTS notifications CASCADE")
    op.execute("DROP TABLE IF EXISTS tasks CASCADE")
    op.execute("DROP TABLE IF EXISTS contracts CASCADE")
    op.execute("DROP TABLE IF EXISTS inventory CASCADE")
    op.execute("DROP TABLE IF EXISTS user_permissions CASCADE")
    op.execute("DROP TABLE IF EXISTS role_permissions CASCADE")
    op.execute("DROP TABLE IF EXISTS user_roles CASCADE")
    op.execute("DROP TABLE IF EXISTS permissions CASCADE")
    op.execute("DROP TABLE IF EXISTS roles CASCADE")
    op.execute("DROP TABLE IF EXISTS products CASCADE")
    op.execute("DROP TABLE IF EXISTS sections CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    op.execute("DROP TABLE IF EXISTS departments CASCADE")

    # ── Enable uuid-ossp extension ─────────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # ── departments (head_user_id added later to avoid circular FK) ───────────
    op.create_table(
        "departments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("head_user_id", UUID(as_uuid=True), nullable=True),  # FK added below
        sa.Column("employee_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("first_name", sa.String, nullable=False),
        sa.Column("last_name", sa.String, nullable=False),
        sa.Column("login", sa.String, nullable=False, unique=True),
        sa.Column("password_hash", sa.String, nullable=False),
        sa.Column("role", sa.String, server_default="manager"),
        sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_login", "users", ["login"])

    # ── departments.head_user_id FK (deferred because users table didn't exist yet)
    op.create_foreign_key(
        "fk_dept_head",
        "departments", "users",
        ["head_user_id"], ["id"],
        use_alter=True,
    )

    # ── contracts ─────────────────────────────────────────────────────────────
    op.create_table(
        "contracts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("contract_no", sa.String, nullable=False, unique=True),
        sa.Column("client_name", sa.String, nullable=False),
        sa.Column("product_type", sa.String, nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit", sa.String, nullable=False),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("priority", sa.String, server_default="medium"),
        sa.Column("status", sa.String, server_default="active"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── tech_processes ────────────────────────────────────────────────────────
    op.create_table(
        "tech_processes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("status", sa.String, server_default="draft"),
        sa.Column("current_step", sa.Integer, server_default="0"),
        sa.Column("approved_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── tech_steps ────────────────────────────────────────────────────────────
    op.create_table(
        "tech_steps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tech_process_id", UUID(as_uuid=True), sa.ForeignKey("tech_processes.id"), nullable=False),
        sa.Column("step_number", sa.Integer, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("responsible_dept", sa.String, nullable=True),
        sa.Column("machine", sa.String, nullable=True),
        sa.Column("time_norm", sa.String, nullable=True),
        sa.Column("status", sa.String, server_default="pending"),
        sa.Column("notes", sa.Text, nullable=True),
    )

    # ── materials ─────────────────────────────────────────────────────────────
    op.create_table(
        "materials",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("code", sa.String, nullable=False, unique=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("category", sa.String, nullable=True),
        sa.Column("unit", sa.String, nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), server_default="0"),
        sa.Column("min_quantity", sa.Numeric(12, 3), server_default="0"),
        sa.Column("location", sa.String, nullable=True),
        sa.Column("status", sa.String, server_default="available"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── stock_in ──────────────────────────────────────────────────────────────
    op.create_table(
        "stock_in",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("material_id", UUID(as_uuid=True), sa.ForeignKey("materials.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("supplier", sa.String, nullable=True),
        sa.Column("received_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("contracts.id"), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("notes", sa.Text, nullable=True),
    )

    # ── stock_out ─────────────────────────────────────────────────────────────
    op.create_table(
        "stock_out",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("material_id", UUID(as_uuid=True), sa.ForeignKey("materials.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("contracts.id"), nullable=True),
        sa.Column("issued_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("notes", sa.Text, nullable=True),
    )

    # ── tech_process_materials ────────────────────────────────────────────────
    op.create_table(
        "tech_process_materials",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tech_process_id", UUID(as_uuid=True), sa.ForeignKey("tech_processes.id"), nullable=False),
        sa.Column("material_id", UUID(as_uuid=True), sa.ForeignKey("materials.id"), nullable=False),
        sa.Column("required_qty", sa.Numeric(12, 3), nullable=False),
        sa.Column("available_qty", sa.Numeric(12, 3), server_default="0"),
        sa.Column("status", sa.String, server_default="pending"),
    )

    # ── tasks ─────────────────────────────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("department_id", UUID(as_uuid=True), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("priority", sa.String, server_default="medium"),
        sa.Column("scheduled_time", sa.Time, nullable=True),
        sa.Column("assigned_to", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("task_date", sa.Date, server_default=sa.func.current_date()),
        sa.Column("status", sa.String, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── notifications ─────────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("type", sa.String, server_default="info"),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_read", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS notifications CASCADE")
    op.execute("DROP TABLE IF EXISTS tasks CASCADE")
    op.execute("DROP TABLE IF EXISTS tech_process_materials CASCADE")
    op.execute("DROP TABLE IF EXISTS stock_out CASCADE")
    op.execute("DROP TABLE IF EXISTS stock_in CASCADE")
    op.execute("DROP TABLE IF EXISTS materials CASCADE")
    op.execute("DROP TABLE IF EXISTS tech_steps CASCADE")
    op.execute("DROP TABLE IF EXISTS tech_processes CASCADE")
    op.execute("DROP TABLE IF EXISTS contracts CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    op.execute("DROP TABLE IF EXISTS departments CASCADE")
