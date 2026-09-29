from fastapi import APIRouter, HTTPException, status
from datetime import datetime, timezone
from typing import List
from app.schemas.instrument import InstrumentCreate, InstrumentOut, InstrumentAttachment
from app.schemas.metrology import InstrumentMeta, SanityCheckResult, AccuracyClass
from app.services.metrology.sanity import InstrumentSanityEngine
from app.core.supabase import get_supabase_client

router = APIRouter()

# Local in-memory cache for offline/test environments
_LOCAL_CACHE: List[InstrumentOut] = [
    InstrumentOut(
        id="inst-001",
        serial_number="PB-1500-SN01",
        model_name="PrecisionBalance PB-1500",
        manufacturer_name="Mettler Toledo Legal Metrology",
        accuracy_class=AccuracyClass.CLASS_III,
        max_capacity=15.0,
        min_capacity=0.1,
        scale_interval_d=0.002,
        verification_interval_e=0.002,
        unit="kg",
        is_multi_interval=False,
        multi_interval_spec=None,
        load_receptor_type="Platform (Single Load Cell)",
        indicator_make_model="MT-IND-2026",
        year_of_manufacture=2026,
        calculated_n=7500,
        attachments=[],
        created_at=datetime(2026, 1, 10, 10, 0, tzinfo=timezone.utc)
    ),
    InstrumentOut(
        id="inst-002",
        serial_number="XB-3000-SN02",
        model_name="ExcellenceBench XB-3000",
        manufacturer_name="Sartorius Metrology Systems",
        accuracy_class=AccuracyClass.CLASS_II,
        max_capacity=30.0,
        min_capacity=0.05,
        scale_interval_d=0.001,
        verification_interval_e=0.005,
        unit="kg",
        is_multi_interval=False,
        multi_interval_spec=None,
        load_receptor_type="Bench Scale",
        indicator_make_model="SAR-IND-3000",
        year_of_manufacture=2026,
        calculated_n=6000,
        attachments=[],
        created_at=datetime(2026, 1, 12, 10, 0, tzinfo=timezone.utc)
    ),
]


def _map_row_to_instrument(row: dict) -> InstrumentOut:
    """Helper to convert Supabase row dictionary to InstrumentOut schema."""
    max_cap = float(row.get("max_capacity", 0))
    e_val = float(row.get("verification_interval_e", 1))
    calc_n = int(round(max_cap / e_val)) if e_val > 0 else 0

    return InstrumentOut(
        id=str(row["id"]),
        serial_number=row["serial_number"],
        model_name=row["model_name"],
        manufacturer_name=row["manufacturer_name"],
        accuracy_class=AccuracyClass(row["accuracy_class"]),
        max_capacity=max_cap,
        min_capacity=float(row.get("min_capacity", 0)),
        scale_interval_d=float(row.get("scale_interval_d", 0)),
        verification_interval_e=e_val,
        unit=row.get("unit", "kg"),
        is_multi_interval=row.get("is_multi_interval", False),
        multi_interval_spec=row.get("multi_interval_spec"),
        load_receptor_type=row.get("load_receptor_type", "Platform"),
        indicator_make_model=row.get("indicator_make_model", "Standard"),
        year_of_manufacture=row.get("year_of_manufacture", 2026),
        calculated_n=calc_n,
        attachments=[],
        created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")) if "created_at" in row else datetime.now(timezone.utc)
    )


@router.get("/", response_model=List[InstrumentOut])
def list_instruments():
    """
    Returns instruments from live Supabase database with cache synchronization.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            res = supabase.table("instruments").select("*").order("created_at", desc=True).execute()
            if res.data is not None:
                db_insts = [_map_row_to_instrument(r) for r in res.data]
                _LOCAL_CACHE.clear()
                _LOCAL_CACHE.extend(db_insts)
                return db_insts
        except Exception as e:
            print(f"[Supabase] Error listing instruments: {e}")

    return _LOCAL_CACHE


@router.get("/{instrument_id}", response_model=InstrumentOut)
def get_instrument(instrument_id: str):
    """
    Retrieves a single instrument by its unique ID from Supabase.
    """
    supabase = get_supabase_client()
    if supabase:
        try:
            res = supabase.table("instruments").select("*").eq("id", instrument_id).execute()
            if res.data and len(res.data) > 0:
                inst = _map_row_to_instrument(res.data[0])
                if not any(i.id == inst.id for i in _LOCAL_CACHE):
                    _LOCAL_CACHE.append(inst)
                return inst
        except Exception as e:
            print(f"[Supabase] Error fetching instrument: {e}")

    inst = next((i for i in _LOCAL_CACHE if i.id == instrument_id), None)
    if not inst:
        raise HTTPException(
            status_code=404,
            detail=f"Instrument '{instrument_id}' not found in database. Please register instrument passport first."
        )
    return inst


@router.post("/validate-sanity", response_model=SanityCheckResult)
def validate_instrument_sanity(payload: InstrumentMeta):
    """
    Executes structural sanity engine validating e >= d, n limits, and min capacity.
    """
    return InstrumentSanityEngine.validate_spec(payload)


@router.post("/", response_model=InstrumentOut, status_code=status.HTTP_201_CREATED)
def create_instrument(payload: InstrumentCreate):
    """
    Creates and registers a new physical instrument in the Supabase database.
    """
    meta = InstrumentMeta(
        accuracy_class=payload.accuracy_class,
        max_capacity=payload.max_capacity,
        min_capacity=payload.min_capacity,
        scale_interval_d=payload.scale_interval_d,
        verification_interval_e=payload.verification_interval_e,
        unit=payload.unit,
        is_multi_interval=payload.is_multi_interval,
        multi_interval_ranges=payload.multi_interval_spec
    )
    sanity = InstrumentSanityEngine.validate_spec(meta)
    if not sanity.is_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Instrument parameters violate OIML R 76 rules", "issues": sanity.issues}
        )

    supabase = get_supabase_client()
    if supabase:
        try:
            insert_data = {
                "serial_number": payload.serial_number,
                "model_name": payload.model_name,
                "manufacturer_name": payload.manufacturer_name,
                "accuracy_class": payload.accuracy_class.value,
                "max_capacity": payload.max_capacity,
                "min_capacity": payload.min_capacity,
                "scale_interval_d": payload.scale_interval_d,
                "verification_interval_e": payload.verification_interval_e,
                "unit": payload.unit,
                "is_multi_interval": payload.is_multi_interval,
                "multi_interval_spec": [s.model_dump() for s in payload.multi_interval_spec] if payload.multi_interval_spec else None
            }
            res = supabase.table("instruments").insert(insert_data).execute()
            if res.data and len(res.data) > 0:
                return _map_row_to_instrument(res.data[0])
        except Exception as e:
            print(f"[Supabase] Error creating instrument: {e}")

    # Local fallback for isolated unit tests
    new_id = f"inst-{len(_LOCAL_CACHE) + 1:03d}"
    new_inst = InstrumentOut(
        id=new_id,
        serial_number=payload.serial_number,
        model_name=payload.model_name,
        manufacturer_name=payload.manufacturer_name,
        accuracy_class=payload.accuracy_class,
        max_capacity=payload.max_capacity,
        min_capacity=payload.min_capacity,
        scale_interval_d=payload.scale_interval_d,
        verification_interval_e=payload.verification_interval_e,
        unit=payload.unit,
        is_multi_interval=payload.is_multi_interval,
        multi_interval_spec=payload.multi_interval_spec,
        load_receptor_type=payload.load_receptor_type,
        indicator_make_model=payload.indicator_make_model,
        year_of_manufacture=payload.year_of_manufacture,
        calculated_n=sanity.calculated_n,
        attachments=[],
        created_at=datetime.now(timezone.utc)
    )
    _LOCAL_CACHE.append(new_inst)
    return new_inst
