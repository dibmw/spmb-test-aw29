import React, { useState } from 'react';
import { X, Mail, LogIn, KeyRound, ShieldAlert } from 'lucide-react';
import { apiService } from '../services/apiService';
import { UserSession } from '../types/spmb';
import { SchoolLogo } from './SchoolLogo';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage('Silakan masukkan alamat email petugas.');
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.loginByEmail(cleanEmail);
      if (result.success && result.session) {
        onLoginSuccess(result.session);
        onClose();
      } else {
        setErrorMessage(result.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kendala saat verifikasi login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        {/* Header with School Branding */}
        <div className="bg-[#1E3A8A] text-white p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 rounded-full bg-blue-600/30 blur-xl pointer-events-none" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-blue-200 hover:text-white hover:bg-blue-800/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5">
            <SchoolLogo size="md" className="shrink-0" />
            <div>
              <span className="inline-block px-2 py-0.5 bg-[#D97706] text-white text-[10px] font-bold uppercase tracking-wider rounded">
                Portal Petugas
              </span>
              <h2 className="text-lg font-extrabold mt-0.5 tracking-tight">Login Portal SPMB</h2>
              <p className="text-xs text-blue-100 font-bold uppercase tracking-wider">AL-WILDAN ISLAMIC SCHOOL 29 DEPOK</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Alamat Email Petugas
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama.penguji@alwildan29.sch.id"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent transition-all"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-[#D97706]" />
                Login tanpa kata sandi. Sistem otomatis memverifikasi hak akses petugas dari sheet terdaftar.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#1E3A8A] hover:bg-blue-900 active:scale-[0.99] text-white text-sm font-bold rounded-xl shadow transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
            >
              {loading ? (
                <span>Memverifikasi Akses...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk ke Dashboard</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
