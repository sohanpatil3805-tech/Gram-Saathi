"""
Unit tests for document storage security, magic bytes inspection,
path traversal prevention, and access authorization.
"""
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.db.base import Base
from backend.db.models import Citizen, Officer, UploadedDocument
from backend.services.storage_service import (
    StorageService,
    DocumentSecurityError,
    DocumentNotFoundError,
    DocumentAccessDeniedError,
)


class DocumentStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)
        self.storage_dir = self.temp_path / "documents"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            echo=False,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Mock settings storage path
        self.settings_patcher = patch(
            "backend.services.storage_service.settings.storage_path",
            new=self.temp_path,
        )
        self.settings_patcher.start()

        # Create citizen and officer
        self.citizen = Citizen(phone_number="+919876543210")
        self.other_citizen = Citizen(phone_number="+919999999999")
        self.officer = Officer(
            username="test_officer",
            hashed_password="mock",
            full_name="Panchayat Officer",
            role="panchayat_officer",
        )
        self.db.add_all([self.citizen, self.other_citizen, self.officer])
        self.db.commit()

    def tearDown(self):
        self.settings_patcher.stop()
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_magic_bytes_inspection_valid_types(self):
        pdf_bytes = b"%PDF-1.5 fake pdf content"
        jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF"
        png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00"

        fmt, mime, ext = StorageService.inspect_content(pdf_bytes)
        self.assertEqual(fmt, "pdf")
        self.assertEqual(mime, "application/pdf")
        self.assertEqual(ext, ".pdf")

        fmt, mime, ext = StorageService.inspect_content(jpeg_bytes)
        self.assertEqual(fmt, "jpeg")
        self.assertEqual(mime, "image/jpeg")

        fmt, mime, ext = StorageService.inspect_content(png_bytes)
        self.assertEqual(fmt, "png")
        self.assertEqual(mime, "image/png")

    def test_spoofed_file_extension_rejected(self):
        # A file named "doc.pdf" but containing executable or plain text bytes
        fake_pdf = b"MZ\x90\x00 malicious content"
        with self.assertRaises(DocumentSecurityError):
            StorageService.inspect_content(fake_pdf)

    def test_empty_file_rejected(self):
        with self.assertRaises(DocumentSecurityError):
            StorageService.inspect_content(b"")

    def test_size_limit_enforced(self):
        oversized = b"%PDF-" + b"0" * (6 * 1024 * 1024)  # 6 MB (limit is 5 MB)
        with self.assertRaises(DocumentSecurityError):
            StorageService.save_document(
                db=self.db,
                citizen_id=self.citizen.id,
                original_filename="large.pdf",
                file_bytes=oversized,
            )

    def test_save_document_uuid_disk_storage(self):
        pdf_bytes = b"%PDF-1.4 official rtc document bytes"
        doc = StorageService.save_document(
            db=self.db,
            citizen_id=self.citizen.id,
            original_filename="../../../malicious_name.pdf",
            file_bytes=pdf_bytes,
            document_type="land_records_rtc",
        )
        self.assertEqual(doc.document_type, "land_records_rtc")
        self.assertEqual(doc.original_filename, "malicious_name.pdf")
        self.assertTrue(doc.stored_filename.endswith(".pdf"))
        # Disk file exists with stored UUID name
        disk_file = self.storage_dir / doc.stored_filename
        self.assertTrue(disk_file.exists())
        self.assertEqual(disk_file.read_bytes(), pdf_bytes)

    def test_access_control_ownership_and_officer(self):
        pdf_bytes = b"%PDF-1.4 sample content"
        doc = StorageService.save_document(
            db=self.db,
            citizen_id=self.citizen.id,
            original_filename="aadhaar.pdf",
            file_bytes=pdf_bytes,
        )

        # 1. Citizen owner can access
        retrieved_doc, path = StorageService.get_document_file(
            db=self.db,
            document_id=doc.id,
            requesting_citizen_id=self.citizen.id,
        )
        self.assertEqual(retrieved_doc.id, doc.id)
        self.assertTrue(path.exists())

        # 2. Officer can access
        _, officer_path = StorageService.get_document_file(
            db=self.db,
            document_id=doc.id,
            requesting_officer_id=self.officer.id,
        )
        self.assertTrue(officer_path.exists())

        # 3. Another citizen is DENIED access (IDOR protection)
        with self.assertRaises(DocumentAccessDeniedError):
            StorageService.get_document_file(
                db=self.db,
                document_id=doc.id,
                requesting_citizen_id=self.other_citizen.id,
            )

        # 4. Anonymous/unauthenticated is DENIED access
        with self.assertRaises(DocumentAccessDeniedError):
            StorageService.get_document_file(
                db=self.db,
                document_id=doc.id,
            )


if __name__ == "__main__":
    unittest.main()
