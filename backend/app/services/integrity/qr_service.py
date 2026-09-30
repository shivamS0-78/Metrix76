"""
Dynamic QR Code Generation Service
Encodes verification URLs with tamper-evident truncated hashes for embedding in PDFs and web views.
"""
import io
import base64
import qrcode


class QRService:
    """
    Service for generating high-contrast, scannable QR codes.
    """

    @staticmethod
    def generate_verification_qr(
        verification_url: str,
        box_size: int = 6,
        border: int = 2
    ) -> str:
        """
        Generates a high-contrast QR code as a base64-encoded data URI (e.g. data:image/png;base64,...).
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=box_size,
            border=border,
        )
        qr.add_data(verification_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buffered = io.BytesIO()
        # Save without format parameter for cross-compatibility with PyPNG and PIL image instances
        img.save(buffered)
        encoded = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{encoded}"

    @staticmethod
    def generate_qr_bytes(
        verification_url: str,
        box_size: int = 6,
        border: int = 2
    ) -> bytes:
        """
        Generates raw PNG bytes for direct file attachment or storage streaming.
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=box_size,
            border=border,
        )
        qr.add_data(verification_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buffered = io.BytesIO()
        img.save(buffered)
        return buffered.getvalue()
