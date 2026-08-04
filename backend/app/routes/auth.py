from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.auth import get_db, verify_password, create_access_token, get_current_user, User
from app.database import AuditLog

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Audit log the login
    log = AuditLog(
        username=user.username,
        action="USER_LOGIN",
        query=None,
        details=f"User logged in with role: {user.role}"
    )
    db.add(log)
    db.commit()

    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role
    }

# Support standard JSON login requests too (optional convenience)
@router.post("/login-json", response_model=Token)
def login_json(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    
    # Audit log the login
    log = AuditLog(
        username=user.username,
        action="USER_LOGIN",
        query=None,
        details=f"User logged in with role: {user.role}"
    )
    db.add(log)
    db.commit()

    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role
    }

@router.get("/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "role": current_user.role,
        "id": current_user.id
    }
