from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime
from typing import List, Optional

from database import SessionLocal, engine, Base
import models, schemas

# Create all tables (idempotent)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SupportDesk CRM", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── DB dependency ─────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Ticket routes ─────────────────────────────────────────────────────────────

@app.get("/api/tickets", response_model=List[schemas.TicketOut])
def list_tickets(
    search: Optional[str] = Query(None, description="Search across name, email, ID, subject, description"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
):
    query = db.query(models.Ticket)

    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                models.Ticket.customer_name.ilike(term),
                models.Ticket.customer_email.ilike(term),
                models.Ticket.ticket_id.ilike(term),
                models.Ticket.subject.ilike(term),
                models.Ticket.description.ilike(term),
            )
        )

    if status:
        query = query.filter(models.Ticket.status == status)

    return query.order_by(models.Ticket.created_at.desc()).all()


@app.post("/api/tickets", response_model=schemas.TicketOut, status_code=201)
def create_ticket(payload: schemas.TicketCreate, db: Session = Depends(get_db)):
    now = datetime.utcnow()
    ticket = models.Ticket(
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        subject=payload.subject,
        description=payload.description,
        status="Open",
        created_at=now,
        updated_at=now,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@app.get("/api/tickets/{ticket_id}", response_model=schemas.TicketDetail)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@app.put("/api/tickets/{ticket_id}", response_model=schemas.TicketOut)
def update_ticket(ticket_id: str, payload: schemas.TicketUpdate, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.status = payload.status
    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)
    return ticket


@app.delete("/api/tickets/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(ticket)
    db.commit()


# ── Note routes ───────────────────────────────────────────────────────────────

@app.get("/api/tickets/{ticket_id}/notes", response_model=List[schemas.NoteOut])
def list_notes(ticket_id: str, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket.notes


@app.post("/api/tickets/{ticket_id}/notes", response_model=schemas.NoteOut, status_code=201)
def add_note(ticket_id: str, payload: schemas.NoteCreate, db: Session = Depends(get_db)):
    ticket = db.query(models.Ticket).filter(models.Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    note = models.Note(
        ticket_id=ticket_id,
        note_text=payload.note_text,
        created_at=datetime.utcnow(),
    )
    db.add(note)

    # Bump ticket updated_at whenever a note is added
    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return note


@app.delete("/api/tickets/{ticket_id}/notes/{note_id}", status_code=204)
def delete_note(ticket_id: str, note_id: int, db: Session = Depends(get_db)):
    note = (
        db.query(models.Note)
        .filter(models.Note.ticket_id == ticket_id, models.Note.id == note_id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()