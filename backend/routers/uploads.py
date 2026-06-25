from fastapi import APIRouter, Depends, UploadFile, File, status
from ..services.cloudinary_service import CloudinaryService, CloudinaryResponse
from ..core.deps import require_roles
from ..models.rol import RolCodigo

router = APIRouter(prefix="/uploads", tags=["Uploads"])
_admin = require_roles(RolCodigo.ADMIN.value)


def _get_service() -> CloudinaryService:
    return CloudinaryService()


@router.post(
    "/imagen",
    response_model=CloudinaryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_admin)],
)
async def upload_imagen(
    file: UploadFile = File(...),
    folder: str = "productos",
    svc: CloudinaryService = Depends(_get_service),
) -> CloudinaryResponse:
    return await svc.upload(file, folder)


@router.delete(
    "/imagen/{public_id:path}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_admin)],
)
async def delete_imagen(
    public_id: str,
    svc: CloudinaryService = Depends(_get_service),
) -> None:
    await svc.delete(public_id)
