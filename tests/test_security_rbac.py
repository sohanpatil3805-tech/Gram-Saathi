"""
Unit tests for RBAC permissions and password hashing security in Gram Saathi.
"""
import unittest

from backend.auth.security import (
    hash_password,
    verify_password,
    has_permission,
    ROLE_CITIZEN,
    ROLE_PANCHAYAT_OFFICER,
    ROLE_TEHSIL_OFFICER,
    ROLE_STATE_ADMIN,
    PERM_VIEW_OWN_APPLICATION,
    PERM_APPROVE_APPLICATION,
    PERM_REJECT_APPLICATION,
    PERM_MANAGE_OFFICERS,
    PERM_UPLOAD_DOCUMENT,
)


class SecurityRBACTests(unittest.TestCase):
    def test_password_hashing_and_verification(self):
        password = "SecurePassword#2026"
        hashed = hash_password(password)

        self.assertTrue(hashed.startswith("pbkdf2_sha256$"))
        self.assertTrue(verify_password(password, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))
        self.assertFalse(verify_password("", hashed))

        # Check salt randomness: two hashes of same password must not be identical
        hashed2 = hash_password(password)
        self.assertNotEqual(hashed, hashed2)
        self.assertTrue(verify_password(password, hashed2))

    def test_citizen_role_permissions(self):
        # Citizen should have citizen permissions
        self.assertTrue(has_permission(ROLE_CITIZEN, PERM_VIEW_OWN_APPLICATION))
        self.assertTrue(has_permission(ROLE_CITIZEN, PERM_UPLOAD_DOCUMENT))

        # Citizen must NEVER have officer or admin permissions
        self.assertFalse(has_permission(ROLE_CITIZEN, PERM_APPROVE_APPLICATION))
        self.assertFalse(has_permission(ROLE_CITIZEN, PERM_REJECT_APPLICATION))
        self.assertFalse(has_permission(ROLE_CITIZEN, PERM_MANAGE_OFFICERS))

    def test_officer_role_permissions(self):
        # Panchayat officer can review but cannot officially approve
        self.assertFalse(has_permission(ROLE_PANCHAYAT_OFFICER, PERM_APPROVE_APPLICATION))

        # Tehsil officer CAN approve and reject
        self.assertTrue(has_permission(ROLE_TEHSIL_OFFICER, PERM_APPROVE_APPLICATION))
        self.assertTrue(has_permission(ROLE_TEHSIL_OFFICER, PERM_REJECT_APPLICATION))

        # Only State Admin can manage officers
        self.assertFalse(has_permission(ROLE_TEHSIL_OFFICER, PERM_MANAGE_OFFICERS))
        self.assertTrue(has_permission(ROLE_STATE_ADMIN, PERM_MANAGE_OFFICERS))


if __name__ == "__main__":
    unittest.main()
