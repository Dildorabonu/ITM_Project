import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.orm import Session
from app.database import engine
from app.models import User, Department

def seed_data():
    with Session(engine) as session:
        # Check if users already exist
        if session.query(User).count() == 0:
            print("Seeding initial users...")
            manager1 = User(full_name="Alisher Usmonov", email="alisher@itm.uz", role="manager")
            manager2 = User(full_name="Dilshod Karimov", email="dilshod@itm.uz", role="manager")
            session.add_all([manager1, manager2])
            session.commit()
            print("Users added successfully.")

        # Check if departments already exist
        if session.query(Department).count() == 0:
            print("Seeding initial departments...")
            
            # Get users to assign as owners
            manager1 = session.query(User).filter_by(email="alisher@itm.uz").first()
            manager2 = session.query(User).filter_by(email="dilshod@itm.uz").first()

            dept1 = Department(name="Mexanika", owner_id=manager1.id if manager1 else None)
            dept2 = Department(name="Himoya", owner_id=manager2.id if manager2 else None)
            dept3 = Department(name="Optika", owner_id=manager1.id if manager1 else None)
            dept4 = Department(name="Tikuv", owner_id=manager2.id if manager2 else None)
            dept5 = Department(name="Antidron", owner_id=manager1.id if manager1 else None)
            
            session.add_all([dept1, dept2, dept3, dept4, dept5])
            session.commit()
            print("Departments added successfully.")
        else:
            print("Database already contains data. Skipping seed.")

if __name__ == "__main__":
    seed_data()
