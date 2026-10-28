"""Persisted sessions, manually verified Yape orders and access control."""
from alembic import op
import sqlalchemy as sa

revision = "0001_accounts_yape"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("account_roles", sa.Column("user_id", sa.String(36), primary_key=True),
        sa.Column("role", sa.String(16), nullable=False), sa.CheckConstraint("role IN ('admin')"))
    op.create_table("web_sessions", sa.Column("id_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False), sa.Column("email", sa.String(254), nullable=False),
        sa.Column("tokens", sa.Text, nullable=False), sa.Column("expires_at", sa.BigInteger, nullable=False),
        sa.Column("created_at", sa.BigInteger, nullable=False))
    op.create_table("payment_orders", sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False), sa.Column("plan_id", sa.String(32), nullable=False),
        sa.Column("loma_id", sa.String(16)), sa.Column("amount_centavos", sa.Integer, nullable=False),
        sa.Column("status", sa.String(24), nullable=False), sa.Column("operation_code", sa.String(64)),
        sa.Column("payment_date", sa.String(10)), sa.Column("reported_centavos", sa.Integer),
        sa.Column("reason", sa.String(500)), sa.Column("created_at", sa.BigInteger, nullable=False),
        sa.Column("reviewed_at", sa.BigInteger), sa.Column("reviewer_id", sa.String(36)),
        sa.CheckConstraint("status IN ('pendiente_pago','en_revision','aprobado','rechazado')"),
        sa.CheckConstraint("amount_centavos > 0"))
    op.create_index("ix_payment_orders_user_id", "payment_orders", ["user_id"])
    op.create_table("verified_yape_operations", sa.Column("operation_key", sa.String(100), primary_key=True),
        sa.Column("order_id", sa.String(36), sa.ForeignKey("payment_orders.id"), nullable=False, unique=True))
    op.create_table("purchase_entitlements", sa.Column("user_id", sa.String(36), primary_key=True),
        sa.Column("scope", sa.String(16), primary_key=True),
        sa.Column("order_id", sa.String(36), sa.ForeignKey("payment_orders.id"), nullable=False))
    op.create_table("payment_audit", sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("order_id", sa.String(36), sa.ForeignKey("payment_orders.id")),
        sa.Column("actor_id", sa.String(36), nullable=False), sa.Column("action", sa.String(32), nullable=False),
        sa.Column("created_at", sa.BigInteger, nullable=False))
    op.create_table("request_buckets", sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("window", sa.BigInteger, primary_key=True), sa.Column("count", sa.Integer, nullable=False),
        sa.Column("expires_at", sa.BigInteger, nullable=False))
    op.create_index("ix_request_buckets_expires_at", "request_buckets", ["expires_at"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lomosoma_api') THEN CREATE ROLE lomosoma_api NOLOGIN NOINHERIT; END IF; END $$")
        op.execute("GRANT USAGE ON SCHEMA public TO lomosoma_api")
        for table in ("account_roles", "web_sessions", "payment_orders", "verified_yape_operations",
                      "purchase_entitlements", "payment_audit", "request_buckets"):
            op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
            op.execute(f'REVOKE ALL ON "{table}" FROM PUBLIC')
            for role in ("anon", "authenticated"):
                if op.get_bind().execute(sa.text("SELECT 1 FROM pg_roles WHERE rolname = :role"), {"role": role}).first():
                    op.execute(f'REVOKE ALL ON "{table}" FROM "{role}"')
            op.execute(f'CREATE POLICY backend_only ON "{table}" TO lomosoma_api USING (true) WITH CHECK (true)')
        for table in ("web_sessions", "request_buckets"):
            op.execute(f'GRANT SELECT, INSERT, UPDATE, DELETE ON "{table}" TO lomosoma_api')
        op.execute('GRANT SELECT, INSERT, UPDATE ON payment_orders TO lomosoma_api')
        for table in ("verified_yape_operations", "purchase_entitlements", "payment_audit"):
            op.execute(f'GRANT SELECT, INSERT ON "{table}" TO lomosoma_api')
        op.execute("GRANT SELECT ON account_roles TO lomosoma_api")
        op.execute("REVOKE ALL ON alembic_version FROM PUBLIC")
        for role in ("anon", "authenticated"):
            if op.get_bind().execute(sa.text("SELECT 1 FROM pg_roles WHERE rolname = :role"), {"role": role}).first():
                op.execute(f'REVOKE ALL ON alembic_version FROM "{role}"')


def downgrade():
    # Financial records must never be silently dropped during an application rollback.
    raise RuntimeError("Restore an audited backup for schema rollback; keep payment records")
