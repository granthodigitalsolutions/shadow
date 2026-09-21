import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface ExaminerProtectedRouteProps {
  children: ReactNode;
}

// Examiners have no account — the only "session" is a batch-scoped token
// issued by POST /api/examiner/verify-code and stored in localStorage. A
// presence check here is sufficient: every API call already 401s naturally
// once the token expires or is invalid, and the deeper validation happens
// server-side on each call (see examinerApi.ts's 401 handling).
export default function ExaminerProtectedRoute({ children }: ExaminerProtectedRouteProps) {
  const token = localStorage.getItem("examinerToken");

  if (!token) {
    return <Navigate to="/examiner" replace />;
  }

  return <>{children}</>;
}
