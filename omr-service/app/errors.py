"""
Errores del servicio. Cada uno lleva su código y su estado HTTP; el mensaje va
en inglés y sin detalles internos porque quien lo traduce y lo enseña es la
aplicación, que sabe en qué idioma habla su usuario.
"""


class OmrError(Exception):
    status = 500
    code = "INTERNAL"

    def __init__(self, message: str = ""):
        super().__init__(message or self.code)
        self.message = message or self.code


class UnsupportedType(OmrError):
    status = 415
    code = "UNSUPPORTED_TYPE"


class TooLarge(OmrError):
    status = 413
    code = "TOO_LARGE"


class ImageTooSmall(OmrError):
    status = 422
    code = "IMAGE_TOO_SMALL"


class BadPdf(OmrError):
    status = 422
    code = "BAD_PDF"


class OmrTimeout(OmrError):
    status = 504
    code = "OMR_TIMEOUT"


class OmrFailed(OmrError):
    status = 502
    code = "OMR_FAILED"


class EmptyScore(OmrError):
    status = 422
    code = "EMPTY_SCORE"


class Busy(OmrError):
    status = 503
    code = "BUSY"


class Unauthorized(OmrError):
    status = 401
    code = "UNAUTHORIZED"
