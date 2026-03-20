from fastapi import APIRouter, HTTPException, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from models.schemas import UserRegister, UserLogin, TokenResponse, UserResponse
from services.database import create_user, get_user_by_email, get_user_by_id
from services.auth import verify_password, hash_password, create_access_token, get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/auth", tags=["auth"])

# FIX: Strict rate limits on auth endpoints to mitigate brute-force attacks.
# 5 attempts per minute per IP for signup/signin.
limiter = Limiter(key_func=get_remote_address)


@router.post("/signup", response_model=TokenResponse)
@limiter.limit("5/minute")
async def signup(request: Request, data: UserRegister):
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


# A pre-computed bcrypt hash of an arbitrary string used to equalise the
# response time when a submitted email doesn't exist in the database.
# Without this, response time leaks whether the email is registered.
_DUMMY_HASH = hash_password("dummy-constant-time-sentinel")


@router.post("/signin", response_model=TokenResponse)
@limiter.limit("5/minute")
async def signin(request: Request, data: UserLogin):
    user_dict = await get_user_by_email(data.email)
    # FIX: Always call verify_password to eliminate the timing side-channel that
    # would let an attacker enumerate valid email addresses by measuring whether
    # the bcrypt step is skipped (fast = unknown email, slow = wrong password).
    candidate_hash = user_dict["hashed_password"] if user_dict else _DUMMY_HASH
    password_ok = verify_password(data.password, candidate_hash)
    if not user_dict or not password_ok:
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
