from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Date, Float, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


# ── Junction tables ──────────────────────────────────────────────────────────

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
)

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)

user_permissions = Table(
    "user_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)


# ── Main tables ───────────────────────────────────────────────────────────────

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")
    users = relationship("User", secondary=user_permissions, back_populates="permissions")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    owner = relationship("User", foreign_keys=[owner_id], back_populates="owned_departments")

    tasks = relationship("Task", back_populates="department")
    inventory = relationship("Inventory", back_populates="department")
    users = relationship("User", foreign_keys="[User.department_id]", back_populates="department")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, default="manager")
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)

    department = relationship("Department", foreign_keys=[department_id], back_populates="users")
    owned_departments = relationship("Department", foreign_keys="[Department.owner_id]", back_populates="owner")
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    permissions = relationship("Permission", secondary=user_permissions, back_populates="users")
    sections = relationship("Section", back_populates="user")


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="sections")
    products = relationship("Product", back_populates="section")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    name = Column(String, nullable=False)
    unit = Column(String, nullable=False)

    section = relationship("Section", back_populates="products")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    title = Column(String, nullable=False)

    planned_quantity = Column(Integer, default=0)
    actual_quantity = Column(Integer, default=0)

    status = Column(String, default="pending")
    comment = Column(Text, nullable=True)

    deadline_time = Column(DateTime, nullable=True)
    task_date = Column(Date, server_default=func.current_date())

    department = relationship("Department", back_populates="tasks")


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    item_name = Column(String, nullable=False)

    stock_quantity = Column(Float, default=0.0)
    unit = Column(String, default="pcs")

    status = Column(String, nullable=True)

    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    department = relationship("Department", back_populates="inventory")