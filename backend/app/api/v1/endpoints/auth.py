from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Literal
from app.core.supabase import get_supabase_client

router = APIRouter()


class AssignRolePayload(BaseModel):
    user_id: str
    role: Literal["TECHNICIAN", "APPROVER", "ADMIN"]


@router.post("/assign-role", status_code=status.HTTP_200_OK)
def assign_role(payload: AssignRolePayload):
    """
    Sets official role into server-controlled app_metadata using Supabase Admin API.
    Prevents role escalation via client-side user_metadata tampering.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase service is not configured or unavailable"
        )

    try:
        res = supabase.auth.admin.update_user_by_id(
            payload.user_id,
            {
                "app_metadata": {
                    "role": payload.role,
                    "roles": [payload.role]
                }
            }
        )
        return {
            "status": "success",
            "message": f"Assigned role {payload.role} to user {payload.user_id}",
            "user_id": payload.user_id,
            "role": payload.role
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign role in app_metadata: {str(e)}"
        )
