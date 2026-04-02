import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";

import { AuthProvider, useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import GenerateSubjectEnrollments from "./pages/GenerateSubjectEnrollments";
import StudentSubjectEnrollments from "./pages/StudentSubjectEnrollments";
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
import MigrateStudentSubjects from "./pages/MigrateStudentSubjects";
import SetupSchoolDefaults from "./pages/SetupSchoolDefaults";
import ExportFirestoreSamples from "./pages/ExportFirestoreSamples";
import TeacherMarkSheets from "./pages/TeacherMarkSheets";
import BulkMarksUpload from "./pages/BulkMarksUpload";

function LoadingScreen() {
  return (
    <Box display="flex" justifyContent="center" mt={10}>
      <CircularProgress />
    </Box>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/teacher" replace />;

  return children;
}

function TeacherRoute({ children }) {
  const { user, loading, isTeacher, isAdmin } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isTeacher && !isAdmin) return <Navigate to="/" replace />;

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Admin / Main Layout */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route
              index
              element={
                <AdminRoute>
                  <Dashboard />
                </AdminRoute>
              }
            />

            <Route
              path="classrooms"
              element={
                <AdminRoute>
                  <ClassroomManagement />
                </AdminRoute>
              }
            />

            <Route
              path="subjects"
              element={
                <AdminRoute>
                  <SubjectManagement />
                </AdminRoute>
              }
            />

            <Route
              path="students"
              element={
                <AdminRoute>
                  <Students />
                </AdminRoute>
              }
            />

            <Route
              path="student-subject-enrollments"
              element={
                <AdminRoute>
                  <GenerateSubjectEnrollments />
                </AdminRoute>
              }
            />

            <Route
              path="manual-student-subject-enrollments"
              element={
                <AdminRoute>
                  <StudentSubjectEnrollments />
                </AdminRoute>
              }
            />

            <Route
              path="migrate-student-subjects"
              element={
                <AdminRoute>
                  <MigrateStudentSubjects />
                </AdminRoute>
              }
            />

            <Route
              path="setup-school-defaults"
              element={
                <AdminRoute>
                  <SetupSchoolDefaults />
                </AdminRoute>
              }
            />

            <Route
              path="marks"
              element={
                <AdminRoute>
                  <MarksEntry />
                </AdminRoute>
              }
            />

            <Route
              path="report/:studentId"
              element={
                <AdminRoute>
                  <ReportCard />
                </AdminRoute>
              }
            />

            <Route
              path="teachers"
              element={
                <AdminRoute>
                  <AdminTeachers />
                </AdminRoute>
              }
            />

            <Route
              path="assignments"
              element={
                <AdminRoute>
                  <TeacherAssignments />
                </AdminRoute>
              }
            />

            <Route
              path="students/by-subject"
              element={
                <AdminRoute>
                  <StudentsBySubject />
                </AdminRoute>
              }
            />

            <Route
              path="terms"
              element={
                <AdminRoute>
                  <AcademicTerms />
                </AdminRoute>
              }
            />

            <Route
              path="class-teachers"
              element={
                <AdminRoute>
                  <ClassTeacherAssignments />
                </AdminRoute>
              }
            />

            <Route
              path="promotion"
              element={
                <AdminRoute>
                  <YearEndPromotion />
                </AdminRoute>
              }
            />

            <Route
              path="teacher-mark-sheets"
              element={
                <AdminRoute>
                  <TeacherMarkSheets />
                </AdminRoute>
              }
            />

            <Route
              path="export-firestore-samples"
              element={
                <AdminRoute>
                  <ExportFirestoreSamples />
                </AdminRoute>
              }
            />
          </Route>

          {/* Teacher Layout */}
          <Route
            path="/teacher"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route
              index
              element={
                <TeacherRoute>
                  <TeacherDashboard />
                </TeacherRoute>
              }
            />

            <Route
              path="marks"
              element={
                <TeacherRoute>
                  <MarksEntry />
                </TeacherRoute>
              }
            />

            <Route
              path="report/:studentId"
              element={
                <TeacherRoute>
                  <ReportCard />
                </TeacherRoute>
              }
            />
          </Route>
          
          <Route path="/bulk-marks-upload" element={<BulkMarksUpload />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}