import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CircularProgress, Box, CssBaseline, ThemeProvider } from "@mui/material";

import { AuthProvider, useAuth } from "./context/AuthContext";
import appTheme from "./theme/appTheme";

import Layout from "./components/Layout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TeacherDashboard from "./pages/TeacherDashboard";

import ClassroomManagement from "./pages/ClassroomManagement";
import SubjectManagement from "./pages/SubjectManagement";
import AcademicTerms from "./pages/AcademicTerms";
import SetupSchoolDefaults from "./pages/SetupSchoolDefaults";

import Students from "./pages/Students";
import StudentsBySubject from "./pages/StudentsBySubject";
import ClassDataManagement from "./pages/ClassDataManagement";

import GenerateSubjectEnrollments from "./pages/GenerateSubjectEnrollments";
import StudentSubjectEnrollments from "./pages/StudentSubjectEnrollments";
import MigrateStudentSubjects from "./pages/MigrateStudentSubjects";

import AdminTeachers from "./pages/AdminTeachers";
import TeacherAssignments from "./pages/TeacherAssignments";
import ClassTeacherAssignments from "./pages/ClassTeacherAssignments";

import MarksEntry from "./pages/MarksEntry";
import BulkMarksUpload from "./pages/BulkMarksUpload";
import TeacherMarkSheets from "./pages/TeacherMarkSheets";
import ReportCard from "./pages/ReportCard";
import ClassReport from "./pages/ClassReport";
import ClassMarksReports from "./pages/reports/ClassMarksReports";

import YearEndPromotion from "./pages/YearEndPromotion";
import ExportFirestoreSamples from "./pages/ExportFirestoreSamples";

function LoadingScreen() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
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
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
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

              {/* Academic Setup */}
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
                path="terms"
                element={
                  <AdminRoute>
                    <AcademicTerms />
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

              {/* Students */}
              <Route
                path="students"
                element={
                  <AdminRoute>
                    <Students />
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
                path="class-data-management"
                element={
                  <AdminRoute>
                    <ClassDataManagement />
                  </AdminRoute>
                }
              />

              {/* Enrollments */}
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

              {/* Staff */}
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
                path="class-teachers"
                element={
                  <AdminRoute>
                    <ClassTeacherAssignments />
                  </AdminRoute>
                }
              />

              {/* Marks & Reports */}
              <Route
                path="marks"
                element={
                  <AdminRoute>
                    <MarksEntry />
                  </AdminRoute>
                }
              />
              <Route
                path="marks-upload"
                element={
                  <AdminRoute>
                    <BulkMarksUpload />
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
                path="class-marks-reports"
                element={
                  <AdminRoute>
                    <ClassMarksReports />
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

              {/* Promotion & Tools */}
              <Route
                path="promotion"
                element={
                  <AdminRoute>
                    <YearEndPromotion />
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
                path="class-report"
                element={
                  <TeacherRoute>
                    <ClassReport />
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

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}