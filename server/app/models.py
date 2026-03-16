from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Date, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


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