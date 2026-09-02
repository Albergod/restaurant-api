import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.core.config import settings
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


async def _upload_to_cloudinary(file: UploadFile, content: bytes) -> str:
    credentials = (
        settings.CLOUDINARY_CLOUD_NAME,
        settings.CLOUDINARY_API_KEY,
        settings.CLOUDINARY_API_SECRET,
    )
    if not all(credentials):
        raise HTTPException(status_code=500, detail="Cloudinary no está configurado")

    url = f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/image/upload"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                url,
                auth=(settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET),
                data={"folder": "restaurant-products"},
                files={"file": (file.filename or "product-image", content, file.content_type)},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="No se pudo guardar la imagen") from exc

    return response.json()["secure_url"]


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

    content = await file.read()
    if settings.MEDIA_STORAGE == "cloudinary":
        return {"url": await _upload_to_cloudinary(file, content)}
    if settings.MEDIA_STORAGE != "local":
        raise HTTPException(status_code=500, detail="Almacenamiento de imágenes no válido")

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = UPLOAD_DIR / filename
    filepath.write_bytes(content)

    return {"url": f"/uploads/{filename}"}


@router.get("/{filename}")
async def get_upload(filename: str):
    """Servir archivos subidos."""
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(str(filepath))
