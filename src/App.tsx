import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { TimekeeperDashboard } from './components/TimekeeperDashboard';
import { PengujiDashboard } from './components/PengujiDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginModal } from './components/LoginModal';
import { StudentCardModal } from './components/StudentCardModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { apiService } from './services/apiService';
import { SiswaJadwal, PresensiRecord, NilaiRecord, UserSession, Role } from './types/spmb';
import { SCHOOL_LOGO_URL } from './data/mockData';
import { MapPin, ShieldCheck, MessageCircle, ExternalLink } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  
  // Data states
  const [jadwalList, setJadwalList] = useState<SiswaJadwal[]>([]);
  const [presensiList, setPresensiList] = useState<PresensiRecord[]>([]);
  const [nilaiList, setNilaiList] = useState<NilaiRecord[]>([]);

  // Student Card Modal State
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<SiswaJadwal | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Reload data from service
  const refreshData = () => {
    setJadwalList(apiService.getJadwalList());
    setPresensiList(apiService.getPresensiList());
    setNilaiList(apiService.getNilaiList());
  };

  useEffect(() => {
    refreshData();
    const existingSession = apiService.getCurrentSession();
    if (existingSession) {
      setSession(existingSession);
    }

    // Background sync with live Google Apps Script if available
    apiService.syncFromGas().then((res) => {
      if (res.success) {
        refreshData();
      }
    }).catch(() => {
      // Keep local data gracefully
    });
  }, []);

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
    refreshData();
    showToast('Login Berhasil', `Selamat datang, ${userSession.nama}. Peran aktif: ${userSession.activeRole}`, 'success');

    // Route directly to appropriate dashboard based on primary role
    if (userSession.activeRole === 'ADMIN') {
      setCurrentTab('admin');
    } else if (userSession.activeRole === 'TIMEKEEPER') {
      setCurrentTab('timekeeper');
    } else if (userSession.activeRole === 'PENGUJI') {
      setCurrentTab('penguji');
    }
  };

  const handleLogout = () => {
    apiService.setSession(null);
    setSession(null);
    setCurrentTab('landing');
    showToast('Sesi Berakhir', 'Anda telah keluar dari portal petugas.', 'info');
  };

  const handleSwitchRole = (newRole: Role) => {
    const updated = apiService.switchRole(newRole);
    if (updated) {
      setSession({ ...updated });
      showToast('Peran Dialihkan', `Kini Anda beroperasi sebagai ${newRole}.`, 'info');

      if (newRole === 'ADMIN') setCurrentTab('admin');
      else if (newRole === 'TIMEKEEPER') setCurrentTab('timekeeper');
      else if (newRole === 'PENGUJI') setCurrentTab('penguji');
      else setCurrentTab('landing');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 selection:bg-amber-200 selection:text-amber-950">
      {/* Toast System */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Primary Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        session={session}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        onSwitchRole={handleSwitchRole}
      />

      {/* Main View Container */}
      <main className="flex-1">
        {currentTab === 'landing' && (
          <LandingPage
            jadwalList={jadwalList}
            presensiList={presensiList}
            onSelectStudentForCard={(s) => setSelectedStudentForCard(s)}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
        )}

        {currentTab === 'timekeeper' && session && (
          <TimekeeperDashboard
            session={session}
            jadwalList={jadwalList}
            presensiList={presensiList}
            onAttendanceSubmitted={(newRecord) => {
              setPresensiList(prev => [newRecord, ...prev]);
            }}
            showToast={showToast}
          />
        )}

        {currentTab === 'penguji' && session && (
          <PengujiDashboard
            session={session}
            jadwalList={jadwalList}
            nilaiList={nilaiList}
            presensiList={presensiList}
            onGradeSaved={(newRecord) => {
              setNilaiList(prev => {
                const idx = prev.findIndex(
                  n => n.id_siswa.toUpperCase() === newRecord.id_siswa.toUpperCase() && 
                       n.kategori_ujian === newRecord.kategori_ujian
                );
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = newRecord;
                  return copy;
                }
                return [newRecord, ...prev];
              });
            }}
            showToast={showToast}
          />
        )}

        {currentTab === 'admin' && session && (
          <AdminDashboard
            session={session}
            jadwalList={jadwalList}
            presensiList={presensiList}
            nilaiList={nilaiList}
            onDataChanged={refreshData}
            showToast={showToast}
          />
        )}
      </main>

      {/* Official Footer */}
      <footer className="bg-slate-900 text-slate-300 border-t-4 border-[#D97706] py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Location & SPMB Contact */}
          <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700/80 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Address */}
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
                <MapPin className="w-4 h-4 text-[#D97706] shrink-0" />
                <span>LOKASI AL-WILDAN ISLAMIC SCHOOL 29 DEPOK</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed pl-6">
                Jl. H. Nawi Malik No.9, Serua, Kec. Bojongsari, Kota Depok, Jawa Barat 16517
              </p>
              <div className="pl-6">
                <a
                  href="https://maps.app.goo.gl/MtkrofBPnCkZG5Un8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors underline underline-offset-4"
                >
                  <span>Buka di Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Hotline WhatsApp */}
            <div className="border-t md:border-t-0 md:border-l border-slate-700/80 pt-4 md:pt-0 md:pl-6 shrink-0">
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">
                Hotline Resmi SPMB
              </span>
              <a
                href="https://wa.me/6282312955731"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-95"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>+62 823 12955731 (WhatsApp)</span>
              </a>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2 text-center sm:text-left">
            <div>
              &copy; {new Date().getFullYear()} PANITIA SPMB AL-WILDAN ISLAMIC SCHOOL 29 DEPOK. HAK CIPTA DILINDUNGI.
            </div>
            <div className="flex items-center justify-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>SISTEM TERPADU TES SPMB TERVERIFIKASI</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Student Card Modal */}
      {selectedStudentForCard && (
        <StudentCardModal
          siswa={selectedStudentForCard}
          onClose={() => setSelectedStudentForCard(null)}
        />
      )}
    </div>
  );
}
