from fastapi import APIRouter
router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True, "service": "oimo-ohapi", "version": "0.1.0"}
