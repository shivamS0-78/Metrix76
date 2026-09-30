from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.metrology import AccuracyClass, MultiIntervalSpec

class InstrumentAttachment(BaseModel):
    id: Optional[str] = None
    attachment_type: str # 'NAMEPLATE', 'LEAD_SEAL', 'LEVEL_BUBBLE', 'OVERALL_FRONT'
    storage_path: str
    file_name: Optional[str] = None
    uploaded_at: Optional[datetime] = None

class InstrumentBase(BaseModel):
    serial_number: str = Field(..., json_schema_extra={"example": "SN-2026-NAWI-8891"})
    model_name: str = Field(..., json_schema_extra={"example": "PreciseWeigh Pro 15"})
    manufacturer_name: str = Field(..., json_schema_extra={"example": "Avery Metrology Ltd."})
    accuracy_class: AccuracyClass = AccuracyClass.CLASS_III
    max_capacity: float = Field(..., gt=0, json_schema_extra={"example": 15.0})
    min_capacity: float = Field(..., ge=0, json_schema_extra={"example": 0.1})
    scale_interval_d: float = Field(..., gt=0, json_schema_extra={"example": 0.002})
    verification_interval_e: float = Field(..., gt=0, json_schema_extra={"example": 0.002})
    unit: str = "kg"
    is_multi_interval: bool = False
    multi_interval_spec: Optional[List[MultiIntervalSpec]] = None
    load_receptor_type: Optional[str] = "Platform"
    indicator_make_model: Optional[str] = "IND-2000-HD"
    year_of_manufacture: Optional[int] = 2026

class InstrumentCreate(InstrumentBase):
    pass

class InstrumentOut(InstrumentBase):
    id: str
    calculated_n: int
    attachments: List[InstrumentAttachment] = []
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
