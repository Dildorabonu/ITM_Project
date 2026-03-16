from sqlalchemy.orm import Session
from . import models, schemas


# DEPARTMENTS

def get_departments(db: Session):
    return db.query(models.Department).all()


def get_department(db: Session, department_id: int):
    return db.query(models.Department).filter(models.Department.id == department_id).first()


def create_department(db: Session, department: schemas.DepartmentCreate):
    db_department = models.Department(**department.model_dump())
    db.add(db_department)
    db.commit()
    db.refresh(db_department)
    return db_department


# TASKS

def get_tasks(db: Session, department_id: int = None):
    query = db.query(models.Task)
    if department_id:
        query = query.filter(models.Task.department_id == department_id)
    return query.all()


def create_department_task(db: Session, task: schemas.TaskCreate):
    db_task = models.Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_task_status(db: Session, task_id: int, actual_qty: int, comment: str = None):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()

    if db_task:
        db_task.actual_quantity = actual_qty
        db_task.comment = comment

        if actual_qty >= db_task.planned_quantity:
            db_task.status = "completed"
        else:
            db_task.status = "delayed"

        db.commit()
        db.refresh(db_task)

    return db_task


# INVENTORY

def get_inventory(db: Session, department_id: int):
    return db.query(models.Inventory).filter(models.Inventory.department_id == department_id).all()


def update_inventory_stock(db: Session, item_id: int, quantity: float):
    db_item = db.query(models.Inventory).filter(models.Inventory.id == item_id).first()

    if db_item:
        db_item.stock_quantity = quantity

        if quantity <= 0:
            db_item.status = "Out of Stock"
        elif quantity <= 5:
            db_item.status = "Low Stock"
        else:
            db_item.status = "In Stock"

        db.commit()
        db.refresh(db_item)

    return db_item