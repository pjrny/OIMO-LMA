import base64, uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import require_level, Principal
from app.core.config import settings
from app.schemas.api import CharacterCreateIn, CharacterOut
from app.models.db_models import Character
from app.services import identity, storage

router = APIRouter()


@router.post("/create", response_model=CharacterOut)
def create_character(
    body: CharacterCreateIn,
    db: Session = Depends(get_db),
    user: Principal = Depends(require_level(2)),  # selfie-verified+
):
    if len(body.images) > settings.max_selfies_per_character:
        raise HTTPException(400, f"Max {settings.max_selfies_per_character} selfies")

    char_id = str(uuid.uuid4())
    ref_keys: list[str] = []
    embedding_hash: str | None = None

    for i, b64 in enumerate(body.images):
        try:
            raw = base64.b64decode(b64.split(",")[-1])
        except Exception:
            raise HTTPException(400, f"Invalid base64 at index {i}")
        try:
            face_png, digest = identity.extract_face(raw)
        except ValueError as e:
            raise HTTPException(422, str(e))
        key = f"characters/{user.user_id}/{char_id}/ref_{i}.png"
        storage.put_bytes(key, face_png, "image/png")
        ref_keys.append(key)
        if i == 0:
            embedding_hash = digest

    char = Character(
        id=char_id, owner_id=user.user_id, name=body.name,
        status="ready", embedding_hash=embedding_hash, reference_keys=ref_keys,
    )
    db.add(char)
    db.commit()
    return CharacterOut(character_id=char.id, status=char.status,
                        embedding_hash=char.embedding_hash)


@router.get("/{character_id}/status", response_model=CharacterOut)
def character_status(
    character_id: str,
    db: Session = Depends(get_db),
    user: Principal = Depends(require_level(2)),
):
    char = db.get(Character, character_id)
    if not char or char.owner_id != user.user_id:
        raise HTTPException(404, "Character not found")
    return CharacterOut(character_id=char.id, status=char.status,
                        embedding_hash=char.embedding_hash)
