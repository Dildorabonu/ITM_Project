from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import List, Optional


# TASK SCHEMAS

class TaskBase(BaseModel):
    title: str
    planned_quantity: int = 0
    actual_quantity: int = 0
    status: str = "pending"
    comment: Optional[str] = None
    deadline_time: Optional[datetime] = None


class TaskCreate(TaskBase):
    department_id: int


class Task(TaskBase):
    id: int
    task_date: date

    model_config = ConfigDict(from_attributes=True)


# INVENTORY SCHEMAS

class InventoryBase(BaseModel):
    item_name: str
    stock_quantity: float
    unit: str = "pcs"
    status: Optional[str] = None


class InventoryCreate(InventoryBase):
    department_id: int


class Inventory(InventoryBase):
    id: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# DEPARTMENT SCHEMAS

class DepartmentBase(BaseModel):
    name: str
    owner_id: Optional[int] = None

class DepartmentCreate(DepartmentBase):
    pass

class Department(DepartmentBase):
    id: int
    created_at: datetime
    updated_at: datetime
    tasks: List[Task] = []
    inventory: List[Inventory] = []

    model_config = ConfigDict(from_attributes=True)