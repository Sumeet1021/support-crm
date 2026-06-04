from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid


def generate_ticket_id():
    return "TKT-" + str(uuid.uuid4())[:8].upper()


class Ticket(Base):
    __tablename__ = "tickets"

    ticket_id   = Column(String, primary_key=True, default=generate_ticket_id)
    customer_name  = Column(String(120), nullable=False)
    customer_email = Column(String(254), nullable=False)
    subject        = Column(String(200), nullable=False)
    description    = Column(Text, nullable=False)
    status         = Column(String(20), nullable=False, default="Open")
    created_at     = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at     = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    notes = relationship("Note", back_populates="ticket", cascade="all, delete-orphan", order_by="Note.created_at")


class Note(Base):
    __tablename__ = "notes"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    ticket_id  = Column(String, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), nullable=False)
    note_text  = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="notes")