import { lazy, Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
const Home = lazy(() => import("./pages/Home"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const SavedEventsPage = lazy(() => import("./pages/SavedEventsPage"));
const MyEventsPage = lazy(() => import("./pages/MyEventsPage"));
const RegisteredEventsPage = lazy(() => import("./pages/RegisteredEventsPage"));
const HostEventPage = lazy(() => import("./pages/HostEventPage"));
const EventPublicViewPage = lazy(() => import("./pages/EventPublicViewPage"));
const EventRegistrationPage = lazy(() => import("./pages/EventRegistrationPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
import ProtectedRoute from "./auth/ProtectedRoute";
import { AuthProvider } from "./auth/AuthProvider";
const SharedEventPage = lazy(() => import("./pages/SharedEventPage"));
const ScannerPage = lazy(() => import("./pages/ScannerPage"));
const TicketPage = lazy(() => import("./pages/TicketPage"));
const InviteAcceptancePage = lazy(() => import("./pages/InviteAcceptancePage"));
import { ThemeProvider } from "./theme/ThemeContext";
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
import { useAuth } from "./auth/useAuth";
import Header from "./components/Header";
import LoggedInHeader from "./components/LoggedInHeader";
const TeamInviteAcceptancePage = lazy(() => import("./pages/TeamInviteAcceptancePage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const PlansPage = lazy(() => import("./pages/PlansPage"));
import VeeAssistant from "./components/VeeAssistant";

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  const { user, sessionExpired } = useAuth();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const expiredRedirectStarted = useRef(false);
  const authPage = pathname === "/login" ? "login" : pathname === "/signup" ? "signup" : pathname === "/verify-email" ? "verify" : undefined;
  const showHeader = pathname !== "/" || Boolean(user);

  useEffect(() => {
    if (!sessionExpired) {
      expiredRedirectStarted.current = false;
      return;
    }
    if (expiredRedirectStarted.current) return;
    expiredRedirectStarted.current = true;
    navigate("/login", {
      replace: true,
      state: { from: `${pathname}${search}`, notice: "Your session expired. Please sign in again." },
    });
  }, [navigate, pathname, search, sessionExpired]);

  return (
    <>
      {showHeader && (user ? <LoggedInHeader /> : <Header authPage={authPage} />)}
      <Suspense fallback={<div className="app-route-loading" role="status">Loading Vista…</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/e/:shareToken" element={<SharedEventPage />} />
        <Route path="/invites/:token" element={<InviteAcceptancePage />} />
        <Route path="/events/:eventId" element={<EventPublicViewPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/saved-events" element={<SavedEventsPage />} />
          <Route path="/my-events" element={<MyEventsPage />} />
          <Route path="/registered-events" element={<RegisteredEventsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/host-event" element={<HostEventPage />} />
          <Route path="/events/:eventId/register" element={<EventRegistrationPage />} />
          <Route path="/team-invites/:token" element={<TeamInviteAcceptancePage />} />
          <Route path="/team-registration-invites/:teamId" element={<TeamInviteAcceptancePage />} />
          <Route path="/scanner/:eventId" element={<ScannerPage />} />
          <Route path="/tickets/:registrationId" element={<TicketPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      </Suspense>
      <VeeAssistant />
    </>
  );
}

export default App;
