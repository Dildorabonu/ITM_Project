import uuid
from sqlalchemy import (
    Column, String, Text, ForeignKey, DateTime, Date, Time,
    Boolean, Integer, Numeric, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


# ── DEPARTMENTS ───────────────────────────────────────────────────────────────

class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    head_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", use_alter=True, name="fk_dept_head"), nullable=True)
    employee_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    head = relationship("User", foreign_keys=[head_user_id], back_populates="headed_departments", post_update=True)
    users = relationship("User", foreign_keys="[User.department_id]", back_populates="department")
    contracts = relationship("Contract", back_populates="department")
    tasks = relationship("Task", back_populates="department")
    stock_outs = relationship("StockOut", back_populates="department")


# ── USERS ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    login = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="manager")
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    department = relationship("Department", foreign_keys=[department_id], back_populates="users")
    headed_departments = relationship("Department", foreign_keys="[Department.head_user_id]", back_populates="head")

    created_contracts = relationship("Contract", back_populates="created_by_user")
    approved_processes = relationship("TechProcess", back_populates="approved_by_user")
    received_stock_ins = relationship("StockIn", back_populates="received_by_user")
    issued_stock_outs = relationship("StockOut", back_populates="issued_by_user")
    assigned_tasks = relationship("Task", foreign_keys="[Task.assigned_to]", back_populates="assignee")
    created_tasks = relationship("Task", foreign_keys="[Task.created_by]", back_populates="creator")
    notifications = relationship("Notification", back_populates="user")


# ── CONTRACTS ─────────────────────────────────────────────────────────────────

class Contract(Base):
    __tablename__ = "contracts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_no = Column(String, unique=True, nullable=False)
    client_name = Column(String, nullable=False)
    product_type = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit = Column(String, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    priority = Column(String, default="medium")   # low / medium / high / urgent
    status = Column(String, default="active")      # active / paused / completed / cancelled
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    department = relationship("Department", back_populates="contracts")
    created_by_user = relationship("User", back_populates="created_contracts")
    tech_processes = relationship("TechProcess", back_populates="contract")
    stock_ins = relationship("StockIn", back_populates="contract")
    stock_outs = relationship("StockOut", back_populates="contract")


# ── TECH_PROCESSES ────────────────────────────────────────────────────────────

class TechProcess(Base):
    __tablename__ = "tech_processes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=False)
    title = Column(String, nullable=False)
    status = Column(String, default="draft")       # draft / in_progress / approved / completed
    current_step = Column(Integer, default=0)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contract = relationship("Contract", back_populates="tech_processes")
    approved_by_user = relationship("User", back_populates="approved_processes")
    steps = relationship("TechStep", back_populates="tech_process", cascade="all, delete-orphan")
    materials = relationship("TechProcessMaterial", back_populates="tech_process", cascade="all, delete-orphan")


# ── TECH_STEPS ────────────────────────────────────────────────────────────────

class TechStep(Base):
    __tablename__ = "tech_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tech_process_id = Column(UUID(as_uuid=True), ForeignKey("tech_processes.id"), nullable=False)
    step_number = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    responsible_dept = Column(String, nullable=True)
    machine = Column(String, nullable=True)
    time_norm = Column(String, nullable=True)
    status = Column(String, default="pending")     # pending / in_progress / done / skipped
    notes = Column(Text, nullable=True)

    tech_process = relationship("TechProcess", back_populates="steps")


# ── MATERIALS ─────────────────────────────────────────────────────────────────

class Material(Base):
    __tablename__ = "materials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    unit = Column(String, nullable=False)
    quantity = Column(Numeric(12, 3), default=0)
    min_quantity = Column(Numeric(12, 3), default=0)
    location = Column(String, nullable=True)
    status = Column(String, default="available")   # available / low / out_of_stock
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    stock_ins = relationship("StockIn", back_populates="material")
    stock_outs = relationship("StockOut", back_populates="material")
    tech_process_materials = relationship("TechProcessMaterial", back_populates="material")


# ── STOCK_IN ──────────────────────────────────────────────────────────────────

class StockIn(Base):
    __tablename__ = "stock_in"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_id = Column(UUID(as_uuid=True), ForeignKey("materials.id"), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False)
    supplier = Column(String, nullable=True)
    received_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text, nullable=True)

    material = relationship("Material", back_populates="stock_ins")
    received_by_user = relationship("User", back_populates="received_stock_ins")
    contract = relationship("Contract", back_populates="stock_ins")


# ── STOCK_OUT ─────────────────────────────────────────────────────────────────

class StockOut(Base):
    __tablename__ = "stock_out"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_id = Column(UUID(as_uuid=True), ForeignKey("materials.id"), nullable=False)
    quantity = Column(Numeric(12, 3), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=True)
    issued_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text, nullable=True)

    material = relationship("Material", back_populates="stock_outs")
    department = relationship("Department", back_populates="stock_outs")
    contract = relationship("Contract", back_populates="stock_outs")
    issued_by_user = relationship("User", back_populates="issued_stock_outs")


# ── TECH_PROCESS_MATERIALS ────────────────────────────────────────────────────

class TechProcessMaterial(Base):
    __tablename__ = "tech_process_materials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tech_process_id = Column(UUID(as_uuid=True), ForeignKey("tech_processes.id"), nullable=False)
    material_id = Column(UUID(as_uuid=True), ForeignKey("materials.id"), nullable=False)
    required_qty = Column(Numeric(12, 3), nullable=False)
    available_qty = Column(Numeric(12, 3), default=0)
    status = Column(String, default="pending")     # pending / partial / ready

    tech_process = relationship("TechProcess", back_populates="materials")
    material = relationship("Material", back_populates="tech_process_materials")


# ── TASKS ─────────────────────────────────────────────────────────────────────

class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    priority = Column(String, default="medium")    # low / medium / high / urgent
    scheduled_time = Column(Time, nullable=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    task_date = Column(Date, server_default=func.current_date())
    status = Column(String, default="pending")     # pending / in_progress / done / cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    department = relationship("Department", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_tasks")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_tasks")


# ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    type = Column(String, default="info")          # info / warning / error / success
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")
