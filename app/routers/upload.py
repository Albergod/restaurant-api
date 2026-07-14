import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.core.security import get_current_user
from app.models.models import UserRole

router = APIRouter(prefix="/api/uploads", tags=["Subidas"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


@router.post("/")
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Subir una imagen. Solo admin."""
    if current_user["role"] != UserRole.admin:
        raise HTTPException(status_code=403, detail="Solo administradores")

    ext = ALLOWED_TYPES.get(file.content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="Formato no permitido. Usa JPEG, PNG, WebP o GIF.")

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = UPLOAD_DIR / filename

    content = await file.read()
    filepath.write_bytes(content)

    return {"url": f"/uploads/{filename}"}


@router.get("/{filename}")
async def get_upload(filename: str):
    """Servir archivos subidos."""
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(str(filepath))
