from fastapi import APIRouter, HTTPException, Depends
from models.schemas import UserRegister, UserLogin, TokenResponse, UserResponse
from services.database import create_user, get_user_by_email, get_user_by_id
from services.auth import verify_password, hash_password, create_access_token, get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
async def signup(data: UserRegister):
    existing = await get_user_by_email(data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(data.password)
    user_dict = await create_user(data.email, data.username, hashed)
    token = create_access_token({"sub": user_dict["id"], "email": user_dict["email"]})
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_dict["id"],
            email=user_dict["email"],
            username=user_dict["username"],
            created_at=datetime.fromisoformat(user_dict["created_at"]),
        ),
    )


@router.post("/signin", response_model=TokenResponse)
async def signin(data: UserLogin):
    user_dict = await get_user_by_email(data.email)
    if not user_dict or not verify_password(data.password, user_dict["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": user_dict["id"], "email": user_dict["email"]})
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_dict["id"],
            email=user_dict["email"],
            username=user_dict["username"],
            created_at=datetime.fromisoformat(user_dict["created_at"]),
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    user_dict = await get_user_by_id(current_user["sub"])
    if not user_dict:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=user_dict["id"],
        email=user_dict["email"],
        username=user_dict["username"],
        created_at=datetime.fromisoformat(user_dict["created_at"]),
    )
