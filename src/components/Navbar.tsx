import React from 'react';
import { 
  UserSession, 
  Role 
} from '../types/spmb';
import { SchoolLogo } from './SchoolLogo';
import { 
  Search, 
  QrCode, 
  FileCheck, 
  Shield, 
  LogIn, 
  LogOut, 
  ChevronDown 
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  session: UserSession | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onSwitchRole: (role: Role) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  session,
  onOpenLogin,
  onLogout,
  onSwitchRole
}) => {
  const [roleMenuOpen, setRoleMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white text-slate-800 shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & School Title */}
          <div 
            onClick={() => onSelectTab('landing')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none min-w-0 mr-2"
          >
            <SchoolLogo size="md" className="group-hover:scale-105 transition-transform shrink-0" />
            <div className="flex flex-col min-w-0 justify-center">
              <span className="text-[11px] sm:text-sm font-black tracking-tight text-[#1E3A8A] leading-tight truncate sm:whitespace-normal">
                AL-WILDAN ISLAMIC SCHOOL 29 DEPOK
              </span>
              <span className="text-[9px] sm:text-xs text-slate-500 font-bold tracking-wider uppercase leading-tight mt-0.5 truncate">
                SISTEM TERPADU TES SPMB 2027/2028
              </span>
            </div>
          </div>

          {/* Navigation Links (Internal Portals) */}
          <nav className="hidden md:flex items-center gap-1.5">
            {/* Timekeeper Tab */}
            {(session?.activeRole === 'TIMEKEEPER' || session?.activeRole === 'ADMIN') && (
              <button
                onClick={() => onSelectTab('timekeeper')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentTab === 'timekeeper'
                    ? 'bg-[#1E3A8A] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-[#1E3A8A]'
                }`}
              >
                <QrCode className="w-4 h-4 text-[#D97706]" />
                <span>Presensi Scanner</span>
              </button>
            )}

            {/* Penguji Tab */}
            {(session?.activeRole === 'PENGUJI' || session?.activeRole === 'ADMIN') && (
              <button
                onClick={() => onSelectTab('penguji')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentTab === 'penguji'
                    ? 'bg-[#1E3A8A] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-[#1E3A8A]'
                }`}
              >
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>Input Nilai</span>
              </button>
            )}

            {/* Admin Tab */}
            {session?.activeRole === 'ADMIN' && (
              <button
                onClick={() => onSelectTab('admin')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  currentTab === 'admin'
                    ? 'bg-[#D97706] text-white shadow-sm'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin Control</span>
              </button>
            )}
          </nav>

          {/* User Session & Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {session ? (
              <div className="relative">
                <div className="flex items-center gap-2">
                  {/* Multi-role Switcher Button */}
                  {session.availableRoles.length > 1 ? (
                    <div className="relative">
                      <button
                        onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 transition-colors cursor-pointer"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse"></span>
                        <span className="text-[#1E3A8A]">{session.activeRole}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      </button>

                      {roleMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
                          <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400">
                            Ganti Peran Aktif:
                          </div>
                          {session.availableRoles.map((role) => (
                            <button
                              key={role}
                              onClick={() => {
                                onSwitchRole(role);
                                setRoleMenuOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                session.activeRole === role
                                  ? 'bg-blue-50 text-[#1E3A8A] font-bold'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span>Peran {role}</span>
                              {session.activeRole === role && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]"></span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="hidden sm:inline-block px-2.5 py-1 bg-blue-50 text-[#1E3A8A] border border-blue-200 text-xs font-bold rounded-lg uppercase">
                      {session.activeRole}
                    </span>
                  )}

                  {/* Profile info */}
                  <div className="hidden lg:block text-right">
                    <div className="text-xs font-bold text-slate-800 leading-tight max-w-[140px] truncate">
                      {session.nama}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                      {session.email}
                    </div>
                  </div>

                  <button
                    onClick={onLogout}
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Keluar"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-slate-300/80 hover:border-[#1E3A8A]/50 bg-slate-50/80 hover:bg-white text-slate-700 hover:text-[#1E3A8A] text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer group shrink-0 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1E3A8A] transition-colors shrink-0" />
                <span>Login Petugas</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar (Only shown if session has accessible portals) */}
        {session && (
          <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 text-xs">
            {(session?.activeRole === 'TIMEKEEPER' || session?.activeRole === 'ADMIN') && (
              <button
                onClick={() => onSelectTab('timekeeper')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer ${
                  currentTab === 'timekeeper' ? 'bg-[#1E3A8A] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 text-[#D97706]" />
                <span>Presensi</span>
              </button>
            )}

            {(session?.activeRole === 'PENGUJI' || session?.activeRole === 'ADMIN') && (
              <button
                onClick={() => onSelectTab('penguji')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer ${
                  currentTab === 'penguji' ? 'bg-[#1E3A8A] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nilai</span>
              </button>
            )}

            {session?.activeRole === 'ADMIN' && (
              <button
                onClick={() => onSelectTab('admin')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer ${
                  currentTab === 'admin' ? 'bg-[#D97706] text-white shadow-sm' : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
          </div>
        )}

      </div>
    </header>
  );
};
