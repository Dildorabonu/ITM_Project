from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from . import models, schemas, crud
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="ITM Production Monitoring System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Welcome to ITM Project Monitoring API"}


# DEPARTMENTS

@app.get("/departments", response_model=List[schemas.Department])
def read_departments(db: Session = Depends(get_db)):
    return crud.get_departments(db)


@app.get("/departments/{department_id}", response_model=schemas.Department)
def read_department(department_id: int, db: Session = Depends(get_db)):
    department = crud.get_department(db, department_id)

    if department is None:
        raise HTTPException(status_code=404, detail="Department not found")

    return department


@app.post("/departments", response_model=schemas.Department)
def create_department(department: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    return crud.create_department(db, department)


# TASKS

@app.post("/tasks", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_department_task(db=db, task=task)


@app.patch("/tasks/{task_id}", response_model=schemas.Task)
def update_task(task_id: int, actual_qty: int, comment: str = None, db: Session = Depends(get_db)):
    updated_task = crud.update_task_status(db, task_id, actual_qty, comment)

    if updated_task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    return updated_task


# INVENTORY

@app.get("/inventory/{department_id}", response_model=List[schemas.Inventory])
def read_inventory(department_id: int, db: Session = Depends(get_db)):
    return crud.get_inventory(db, department_id)


@app.patch("/inventory/{item_id}", response_model=schemas.Inventory)
def update_stock(item_id: int, quantity: float, db: Session = Depends(get_db)):
    updated_item = crud.update_inventory_stock(db, item_id, quantity)

    if updated_item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    return updated_item


# SECTIONS

@app.get("/sections", response_model=List[schemas.Section])
def read_sections(db: Session = Depends(get_db)):
    return crud.get_sections(db)


@app.post("/sections", response_model=schemas.Section)
def create_section(section: schemas.SectionCreate, db: Session = Depends(get_db)):
    return crud.create_section(db, section)


@app.get("/sections/{section_id}", response_model=schemas.Section)
def read_section(section_id: int, db: Session = Depends(get_db)):
    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if section is None:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


# PRODUCTS

@app.get("/sections/{section_id}/products", response_model=List[schemas.Product])
def read_section_products(section_id: int, db: Session = Depends(get_db)):
    return crud.get_products_by_section(db, section_id)


@app.post("/sections/{section_id}/products", response_model=schemas.Product)
def create_section_product(section_id: int, product: schemas.ProductCreate, db: Session = Depends(get_db)):
    if section_id != product.section_id:
        raise HTTPException(status_code=400, detail="Section ID mismatch")
    return crud.create_product(db, product)


@app.patch("/products/{product_id}", response_model=schemas.Product)
def update_product(product_id: int, name: str = None, unit: str = None, db: Session = Depends(get_db)):
    updated = crud.update_product(db, product_id, name, unit)
    if updated is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return updated


@app.delete("/products/{product_id}", response_model=schemas.Product)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_product(db, product_id)
    if deleted is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return deleted