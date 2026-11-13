import React, { createContext, useContext, useState, useEffect } from 'react';
import { OfficerRole, OfficerUser } from '../types/officer';

interface OfficerAuthContextType {
  isAuthenticated: boolean;
  officer: OfficerUser | null;
  login: (role: OfficerRole, customUser?: Partial<OfficerUser>) => void;
  logout: () => void;
  switchRole: (role: OfficerRole) => void;
}

export const DEMO_OFFICERS: Record<OfficerRole, OfficerUser> = {
  PANCHAYAT_STAFF: {
    id: 'off-panchayat-01',
    username: 'suresh_maddur',
    full_name: 'Suresh Gowda (ಸುರೇಶ್ ಗೌಡ)',
    role: 'PANCHAYAT_STAFF',
    role_display_name: 'Panchayat Development Officer (PDO)',
    jurisdiction_district: 'Mandya (ಮಂಡ್ಯ)',
    jurisdiction_taluk: 'Maddur (ಮದ್ದೂರು)',
    jurisdiction_village: 'Maddur Grama (ಮದ್ದೂರು ಗ್ರಾಮ)',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  TEHSIL_STAFF: {
    id: 'off-tehsil-02',
    username: 'ramesh_taluk',
    full_name: 'Ramesh Patil (ರಮೇಶ್ ಪಾಟೀಲ್)',
    role: 'TEHSIL_STAFF',
    role_display_name: 'Tahsildar / Taluk Executive Magistrate',
    jurisdiction_district: 'Mandya (ಮಂಡ್ಯ)',
    jurisdiction_taluk: 'Maddur Taluk (ಮದ್ದೂರು ತಾಲೂಕು)',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  },
  ADMIN: {
    id: 'off-admin-03',
    username: 'anita_dc_office',
    full_name: 'Dr. Anita Rao, IAS (ಡಾ. ಅನಿತಾ ರಾವ್)',
    role: 'ADMIN',
    role_display_name: 'District Commissioner / State Admin',
    jurisdiction_district: 'State Oversight (Karnataka)',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
};

const OfficerAuthContext = createContext<OfficerAuthContextType | undefined>(undefined);

export const OfficerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [officer, setOfficer] = useState<OfficerUser | null>(() => {
    const saved = localStorage.getItem('gram_saathi_officer');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    // Default to Panchayat Staff for demo immediacy
    return DEMO_OFFICERS.PANCHAYAT_STAFF;
  });

  const login = (role: OfficerRole, customUser?: Partial<OfficerUser>) => {
    const base = DEMO_OFFICERS[role];
    const user = customUser ? { ...base, ...customUser } : base;
    setOfficer(user);
    localStorage.setItem('gram_saathi_officer', JSON.stringify(user));
  };

  const logout = () => {
    setOfficer(null);
    localStorage.removeItem('gram_saathi_officer');
  };

  const switchRole = (role: OfficerRole) => {
    login(role);
  };

  return (
    <OfficerAuthContext.Provider
      value={{
        isAuthenticated: !!officer,
        officer,
        login,
        logout,
        switchRole,
      }}
    >
      {children}
    </OfficerAuthContext.Provider>
  );
};

export const useOfficerAuth = (): OfficerAuthContextType => {
  const context = useContext(OfficerAuthContext);
  if (!context) {
    throw new Error('useOfficerAuth must be used within an OfficerAuthProvider');
  }
  return context;
};
