"""Pure Pydantic validation tests — no DB, no network."""
import pytest
from pydantic import ValidationError

from models.schemas import UserRegister, ResearchRequest, ResearchDepth


def test_user_register_accepts_valid_data():
    u = UserRegister(email="valid@example.com", username="valid_user-1", password="LongEnough1")
    assert u.username == "valid_user-1"


@pytest.mark.parametrize("username", ["has space", "semi;colon", "emoji😀", "a", "x" * 51])
def test_user_register_rejects_bad_username(username):
    with pytest.raises(ValidationError):
        UserRegister(email="valid@example.com", username=username, password="LongEnough1")


def test_user_register_rejects_short_password():
    with pytest.raises(ValidationError):
        UserRegister(email="valid@example.com", username="valid_user", password="short1")


def test_user_register_rejects_invalid_email():
    with pytest.raises(ValidationError):
        UserRegister(email="not-an-email", username="valid_user", password="LongEnough1")


def test_research_request_defaults():
    r = ResearchRequest(query="a valid research query")
    assert r.depth == ResearchDepth.standard
    assert r.offline_mode is True
    assert r.model == "llama3:8b"


@pytest.mark.parametrize("model", [
    "llama3:8b; rm -rf /",
    "../../etc/passwd",
    "model with spaces",
    "$(whoami)",
])
def test_research_request_rejects_unsafe_model_names(model):
    with pytest.raises(ValidationError):
        ResearchRequest(query="a valid research query", model=model)


def test_research_request_accepts_safe_model_names():
    r = ResearchRequest(query="a valid research query", model="llama3.2:latest")
    assert r.model == "llama3.2:latest"


def test_research_request_rejects_short_query():
    with pytest.raises(ValidationError):
        ResearchRequest(query="ab")
