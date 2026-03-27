import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import MarksEntry from "./pages/MarksEntry";
import ReportCard from "./pages/ReportCard";
import AdminTeachers from "./pages/AdminTeachers";
import TeacherDashboard from "./pages/TeacherDashboard";
import ClassroomManagement from "./pages/ClassroomManagement";
import SubjectManagement from "./pages/SubjectManagement";
import Layout from "./components/Layout";
import YearEndPromotion from "./pages/YearEndPromotion";
import TeacherAssignments from "./pages/TeacherAssignments";
import StudentsBySubject from "./pages/StudentsBySubject";
import ClassTeacherAssignments from "./pages/ClassTeacherAssignments";
import AcademicTerms from "./pages/AcademicTerms";
import { CircularProgress, Box } from "@mui/material";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/teacher" />;
  return children;
}

function TeacherRoute({ children }) {
  const { user, loading, isTeacher } = useAuth();
  if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  if (!user) return <Navigate to="/login" />;
  if (!isTeacher) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* ── Admin Routes ── */}
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="classrooms"     element={<AdminRoute><ClassroomManagement /></AdminRoute>} />
            <Route path="subjects"       element={<AdminRoute><SubjectManagement /></AdminRoute>} />
            <Route path="students"       element={<AdminRoute><Students /></AdminRoute>} />
            <Route path="marks"          element={<AdminRoute><MarksEntry /></AdminRoute>} />
            <Route path="report/:studentId" element={<AdminRoute><ReportCard /></AdminRoute>} />
            <Route path="teachers"       element={<AdminRoute><AdminTeachers /></AdminRoute>} />
            <Route path="assignments"    element={<AdminRoute><TeacherAssignments /></AdminRoute>} />
            <Route path="students/by-subject" element={<AdminRoute><StudentsBySubject /></AdminRoute>} />
            <Route path="terms"          element={<AdminRoute><AcademicTerms /></AdminRoute>} />
            <Route path="class-teachers" element={<AdminRoute><ClassTeacherAssignments /></AdminRoute>} />
            <Route path="promotion"      element={<AdminRoute><YearEndPromotion /></AdminRoute>} />
          </Route>

          {/* ── Teacher Routes ── */}
          <Route path="/teacher" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
            <Route path="marks"          element={<TeacherRoute><MarksEntry /></TeacherRoute>} />
            <Route path="report/:studentId" element={<TeacherRoute><ReportCard /></TeacherRoute>} />
          </Route>

        </Routes>
      </Router>
    </AuthProvider>
  );
}