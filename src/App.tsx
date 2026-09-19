import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuthStore } from './store/authStore'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import NotesPage from './pages/NotesPage'
import NoteEditorPage from './pages/NoteEditorPage'
import PracticePage from './pages/PracticePage'
import PracticeSetPage from './pages/PracticeSetPage'
import SlidesPage from './pages/SlidesPage'
import SlideDeckPage from './pages/SlideDeckPage'
import SchedulePage from './pages/SchedulePage'
import ProfilePage from './pages/ProfilePage'
import LeaguePage from './pages/LeaguePage'
import UpgradePage from './pages/UpgradePage'
import SharedPage from './pages/SharedPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsPage from './pages/TermsPage'

function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/s/:kind/:token" element={<SharedPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/notes" element={<NotesPage />} />
                  <Route path="/notes/:id" element={<NoteEditorPage />} />
                  <Route path="/practice" element={<PracticePage />} />
                  <Route path="/practice/:id" element={<PracticeSetPage />} />
                  <Route path="/slides" element={<SlidesPage />} />
                  <Route path="/slides/:id" element={<SlideDeckPage />} />
                  <Route path="/schedule" element={<SchedulePage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/league" element={<LeaguePage />} />
                  <Route path="/upgrade" element={<UpgradePage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
