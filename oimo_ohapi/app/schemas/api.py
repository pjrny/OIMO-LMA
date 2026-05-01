from pydantic import BaseModel, Field, conlist


class CharacterCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    images: conlist(str, min_length=1, max_length=5)  # base64 PNG/JPEG
    description: str | None = Field(default=None, max_length=1000)


class CharacterOut(BaseModel):
    character_id: str
    status: str
    embedding_hash: str | None = None


class GenerateIn(BaseModel):
    character_id: str
    prompt: str = Field(min_length=4, max_length=4000)
    scene_id: str | None = None
    width: int = Field(default=1024, ge=512, le=2048)
    height: int = Field(default=1536, ge=512, le=2048)
    seed: int | None = None
    guidance: float = Field(default=6.5, ge=1.0, le=15.0)
    controlnet_pose: str | None = None  # scene-specific OpenPose key


class JobOut(BaseModel):
    job_id: str
    status: str
    url: str | None = None
    provider: str | None = None
    error: str | None = None
