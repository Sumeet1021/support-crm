from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ── Note schemas ──────────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    note_text: str = Field(..., min_length=1, max_length=2000)


class NoteOut(BaseModel):
    id: int
    ticket_id: str
    note_text: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Ticket schemas ────────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    customer_name:  str = Field(..., min_length=1, max_length=120)
    customer_email: EmailStr
    subject:        str = Field(..., min_length=1, max_length=200)
    description:    str = Field(..., min_length=1)


class TicketUpdate(BaseModel):
    status: str = Field(..., pattern="^(Open|In Progress|Closed)$")


class TicketOut(BaseModel):
    ticket_id:      str
    customer_name:  str
    customer_email: str
    subject:        str
    description:    str
    status:         str
    created_at:     datetime
    updated_at:     datetime

    class Config:
        from_attributes = True


class TicketDetail(TicketOut):
    notes: List[NoteOut] = []

    class Config:
        from_attributes = True