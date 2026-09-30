from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class ReferenceStandardBase(BaseModel):
    set_identifier: str = Field(..., json_schema_extra={"example": "NPL-E2-SET-04"})
    accuracy_class: str = Field(..., json_schema_extra={"example": "E2"})
    certificate_number: str = Field(..., json_schema_extra={"example": "CAL-2025-0892"})
    calibrated_by: str = Field(..., json_schema_extra={"example": "National Physical Laboratory"})
    calibration_date: date
    expiry_date: date
    expanded_uncertainty_k2: Optional[float] = Field(None, description="Expanded Uncertainty U (k=2)")
    nominal_range: Optional[str] = Field("1 mg to 50 kg", description="Nominal range of weights")
    is_active: bool = True

class ReferenceStandardCreate(ReferenceStandardBase):
    pass

class ReferenceStandardUpdate(BaseModel):
    set_identifier: Optional[str] = None
    accuracy_class: Optional[str] = None
    certificate_number: Optional[str] = None
    calibrated_by: Optional[str] = None
    calibration_date: Optional[date] = None
    expiry_date: Optional[date] = None
    expanded_uncertainty_k2: Optional[float] = None
    nominal_range: Optional[str] = None
    is_active: Optional[bool] = None

class ReferenceStandardOut(ReferenceStandardBase):
    id: str
    is_expired: bool
    days_to_expiry: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
