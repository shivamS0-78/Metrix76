from fastapi import APIRouter
from app.api.v1.endpoints import (
    dashboard,
    reference_standards,
    instruments,
    metrology,
    documents,
    verification,
    reports,
    attachments,
    auth
)

api_router = APIRouter()

api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Executive Dashboard (Module 1)"])
api_router.include_router(reference_standards.router, prefix="/standards", tags=["Reference Standards (Module 2)"])
api_router.include_router(instruments.router, prefix="/instruments", tags=["Instrument Passport (Module 3)"])
api_router.include_router(metrology.router, prefix="/metrology", tags=["Metrology Evaluation Core (Module 4)"])
api_router.include_router(documents.router, prefix="/documents", tags=["Document Generation Pipeline"])
api_router.include_router(verification.router, prefix="/verification", tags=["Two-Man Verification (Module 5)"])
api_router.include_router(reports.router, prefix="/reports", tags=["Searchable Archive & Verification (Module 6)"])
api_router.include_router(attachments.router, prefix="/attachments", tags=["Evidence & Photographic Vault"])
api_router.include_router(auth.router, prefix="/auth", tags=["Role & Access Management"])
