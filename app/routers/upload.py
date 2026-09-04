import logging
import re
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.security import get_current_user
from app.models.models import UserRole

router = APIRouter(prefix="/api/uploads", tags=["Subidas"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _cloudinary_public_id(image_url: str) -> str | None:
    parsed = urlparse(image_url)
    if parsed.hostname != "res.cloudinary.com":
        return None

    parts = parsed.path.strip("/").split("/")
    if len(parts) < 6 or parts[0] != settings.CLOUDINARY_CLOUD_NAME:
        return None
    try:
        upload_index = parts.index("upload")
    except ValueError:
        return None

    asset_parts = parts[upload_index + 1:]
    if asset_parts and re.fullmatch(r"v\d+", asset_parts[0]):
        asset_parts = asset_parts[1:]
    if not asset_parts:
        return None

    public_id = unquote("/".join(asset_parts))
    return public_id.rsplit(".", 1)[0]


async def delete_image(image_url: str | None) -> None:
    if not image_url:
        return

    public_id = _cloudinary_public_id(image_url)
    if public_id:
        url = f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/image/destroy"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    url,
                    auth=(settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET),
                    data={"public_id": public_id, "invalidate": "true"},
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("No se pudo eliminar %s de Cloudinary: %s", public_id, exc)
        return

    if image_url.startswith("/uploads/"):
        path = UPLOAD_DIR / Path(image_url).name
        path.unlink(missing_ok=True)


async def _upload_to_cloudinary(file: UploadFile, content: bytes) -> str:
    credentials = (
        settings.CLOUDINARY_CLOUD_NAME,
        settings.CLOUDINARY_API_KEY,
        settings.CLOUDINARY_API_SECRET,
    )
    if not all(credentials):
        raise HTTPException(status_code=500, detail="Cloudinary no está configurado")

    url = f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/image/upload"
    public_id = f"restaurant-products/{uuid.uuid4().hex}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                url,
                auth=(settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET),
                data={"public_id": public_id},
                files={"file": (file.filename or "product-image", content, file.content_type)},
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        logger.warning("Cloudinary rechazó la subida (%s): %s", status, exc.response.text[:500])
        raise HTTPException(status_code=502, detail=f"Cloudinary rechazó la imagen ({status})") from exc
    except httpx.RequestError as exc:
        logger.warning("No se pudo conectar con Cloudinary: %s", exc)
        raise HTTPException(status_code=502, detail="No se pudo conectar con Cloudinary") from exc

    return response.json()["secure_url"]


@router.post("/")
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in [UserRole.admin.value, UserRole.superadmin.value]:
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
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(str(filepath))
