import mercadopago
from fastapi import HTTPException
from ..core.config import settings
from ..models.pedido import Pedido


def _sdk() -> mercadopago.SDK:
    if not settings.MP_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="Mercado Pago no configurado")
    return mercadopago.SDK(settings.MP_ACCESS_TOKEN)


def crear_preference(pedido: Pedido) -> dict:
    sdk = _sdk()
    base = settings.MP_STORE_URL

    items = [
        {
            "title": d.nombre_snapshot,
            "quantity": d.cantidad,
            "unit_price": float(d.precio_snapshot),
            "currency_id": "ARS",
        }
        for d in pedido.detalles
    ]
    if pedido.costo_envio > 0:
        items.append({
            "title": "Costo de envio",
            "quantity": 1,
            "unit_price": float(pedido.costo_envio),
            "currency_id": "ARS",
        })

    ngrok = settings.MP_WEBHOOK_URL.replace("/api/v1/mp/webhook", "") if settings.MP_WEBHOOK_URL else ""
    back_base = ngrok if ngrok else base
    skip = "&ngrok-skip-browser-warning=1" if ngrok else ""

    preference_data = {
        "items": items,
        "back_urls": {
            "success": f"{back_base}/api/v1/mp/retorno?status=approved{skip}",
            "failure": f"{back_base}/api/v1/mp/retorno?status=failure{skip}",
            "pending": f"{back_base}/api/v1/mp/retorno?status=pending{skip}",
        },
        "auto_return": "approved",
        "external_reference": str(pedido.id),
        "statement_descriptor": "FoodStore",
        **({"notification_url": settings.MP_WEBHOOK_URL} if settings.MP_WEBHOOK_URL else {}),
    }

    result = sdk.preference().create(preference_data)
    if result["status"] not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Error al crear preferencia MP: {result.get('response')}",
        )

    response = result["response"]
    url_key = "init_point"
    return {
        "preference_id": response["id"],
        "init_point": response[url_key],
    }
