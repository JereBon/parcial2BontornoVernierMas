import asyncio
import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile
from pydantic import BaseModel
from ..core.config import settings

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_SIZE = 5 * 1024 * 1024  # 5 MB
_FOLDER = "foodstore"


class CloudinaryResponse(BaseModel):
    secure_url: str
    public_id: str
    width: int | None = None
    height: int | None = None
    format: str | None = None
    resource_type: str = "image"


def _init_cloudinary() -> None:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )


class CloudinaryService:
    def __init__(self) -> None:
        _init_cloudinary()

    async def upload(self, file: UploadFile, folder: str = "productos") -> CloudinaryResponse:
        if file.content_type not in _ALLOWED_TYPES:
            raise HTTPException(400, f"Tipo de archivo no permitido: {file.content_type}. Use JPEG, PNG o WebP.")
        content = await file.read()
        if len(content) > _MAX_SIZE:
            raise HTTPException(413, "El archivo excede el tamaño máximo de 5 MB.")

        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            content,
            folder=f"{_FOLDER}/{folder}",
            resource_type="image",
            overwrite=False,
            unique_filename=True,
            allowed_formats=["jpg", "jpeg", "png", "webp"],
        )
        return CloudinaryResponse(
            secure_url=result["secure_url"],
            public_id=result["public_id"],
            width=result.get("width"),
            height=result.get("height"),
            format=result.get("format"),
        )

    async def delete(self, public_id: str) -> None:
        await asyncio.to_thread(
            cloudinary.uploader.destroy,
            public_id,
            resource_type="image",
        )
