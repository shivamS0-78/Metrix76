from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api_router import api_router
from app.schemas.metrology import WeighingBatchRequest, WeighingBatchResponse
from app.services.metrology.engine import OIMLR76Engine

app = FastAPI(
    title="OIML R 76 Legal Metrology Core API",
    version="1.0.0",
    description="Statutory compliance & LIMS engine for Non-Automatic Weighing Instruments (NAWIs) conforming to OIML R 76-1 / R 76-2"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root level healthcheck & live status
@app.get("/health")
def health():
    return {"status": "healthy", "service": "oiml-r76-fastapi", "version": "1.0.0"}

# Mount API v1 router
app.include_router(api_router, prefix="/api/v1")

# Direct legacy endpoint for backwards compatibility
@app.post("/api/v1/metrology/evaluate-weighing", response_model=WeighingBatchResponse, include_in_schema=False)
def legacy_evaluate_weighing(payload: WeighingBatchRequest):
    return OIMLR76Engine.evaluate_weighing_batch(payload.instrument, payload.points)
