import io
import base64
from functools import lru_cache

import qrcode


@lru_cache(maxsize=512)
def generate_qr_image(data: str) -> str:
    """Generate a QR code image and return it as a base64 data URI.

    Cacheado en memoria: el QR de una mesa solo cambia con regenerate-qr,
    así que no se regenera en cada GET /api/tables/.
    """
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"
