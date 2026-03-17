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


# SECTIONS

def get_sections(db: Session):
    sections = db.query(models.Section).order_by(models.Section.id).all()
    unique_sections = {}
    duplicates = []

    for section in sections:
        if section.name not in unique_sections:
            unique_sections[section.name] = section
        else:
            duplicates.append((section, unique_sections[section.name]))

    if duplicates:
        for duplicate_section, keep_section in duplicates:
            # move product relationships to the kept section before deleting duplicate
            for prod in duplicate_section.products:
                prod.section_id = keep_section.id
            db.delete(duplicate_section)
        db.commit()

    return list(unique_sections.values())


def get_section_by_name(db: Session, name: str):
    return db.query(models.Section).filter(models.Section.name == name).first()


def create_section(db: Session, section: schemas.SectionCreate):
    existing = get_section_by_name(db, section.name)
    if existing:
        return existing
    db_section = models.Section(**section.model_dump())
    db.add(db_section)
    db.commit()
    db.refresh(db_section)
    return db_section


# PRODUCTS

def get_products_by_section(db: Session, section_id: int):
    return db.query(models.Product).filter(models.Product.section_id == section_id).all()


def create_product(db: Session, product: schemas.ProductCreate):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


def update_product(db: Session, product_id: int, name: str = None, unit: str = None):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        return None
    if name is not None:
        db_product.name = name
    if unit is not None:
        db_product.unit = unit
    db.commit()
    db.refresh(db_product)
    return db_product


def delete_product(db: Session, product_id: int):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        return None
    db.delete(db_product)
    db.commit()
    return db_product