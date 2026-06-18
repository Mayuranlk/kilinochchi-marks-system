import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CircularProgress, Box, CssBaseline, ThemeProvider } from "@mui/material";

import { AuthProvider, useAuth } from "./context/AuthContext";
import appTheme from "./theme/appTheme";

import Layout from "./components/Layout";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const SectionalHeadDashboard = lazy(() => import("./pages/SectionalHeadDashboard"));

const ClassroomManagement = lazy(() => import("./pages/ClassroomManagement"));
const SubjectManagement = lazy(() => import("./pages/SubjectManagement"));
const AcademicTerms = lazy(() => import("./pages/AcademicTerms"));
const PracticeExams = lazy(() => import("./pages/PracticeExams"));
const SetupSchoolDefaults = lazy(() => import("./pages/SetupSchoolDefaults"));

const Students = lazy(() => import("./pages/Students"));
const StudentsBySubject = lazy(() => import("./pages/StudentsBySubject"));
const ClasswiseStudentList = lazy(() => import("./pages/ClasswiseStudentList"));
const ClassDataManagement = lazy(() => import("./pages/ClassDataManagement"));
const ClassShuffle = lazy(() => import("./pages/ClassShuffle"));

const GenerateSubjectEnrollments = lazy(() => import("./pages/GenerateSubjectEnrollments"));
const StudentSubjectEnrollments = lazy(() => import("./pages/StudentSubjectEnrollments"));
const MigrateStudentSubjects = lazy(() => import("./pages/MigrateStudentSubjects"));

const AdminTeachers = lazy(() => import("./pages/AdminTeachers"));
const TeacherAssignments = lazy(() => import("./pages/TeacherAssignments"));
const ClassTeacherAssignments = lazy(() => import("./pages/ClassTeacherAssignments"));

const MarksEntry = lazy(() => import("./pages/MarksEntry"));
const BulkMarksUpload = lazy(() => import("./pages/BulkMarksUpload"));
const TeacherMarkSheets = lazy(() => import("./pages/TeacherMarkSheets"));
const ReportCard = lazy(() => import("./pages/ReportCard"));
const ClassReport = lazy(() => import("./pages/ClassReport"));
const ClassMarksReports = lazy(() => import("./pages/reports/ClassMarksReports"));
const ClassCompletionReport = lazy(() => import("./pages/reports/ClassCompletionReport"));
const SubjectAnalysis = lazy(() => import("./pages/SubjectAnalysis"));

const YearEndPromotion = lazy(() => import("./pages/YearEndPromotion"));
const ExportFirestoreSamples = lazy(() => import("./pages/ExportFirestoreSamples"));
const SBAForm = lazy(() => import("./pages/SBAForm"));
const ElectionCount = lazy(() => import("./pages/ElectionCount"));
const ElectionLiveResults = lazy(() => import("./pages/ElectionLiveResults"));

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

function LazyRoute({ children }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin, isSectionalHead } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to={isSectionalHead ? "/sectional-head" : "/teacher"} replace />;

  return children;
}

function ReportAccessRoute({ children }) {
  const { user, loading, canAccessAllReports, isSectionalHead, isTeacher } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessAllReports) {
    return <Navigate to={isSectionalHead ? "/sectional-head" : isTeacher ? "/teacher" : "/"} replace />;
  }

  return children;
}

function TeacherRoute({ children }) {
  const { user, loading, isTeacher, isAdmin } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isTeacher && !isAdmin) return <Navigate to="/" replace />;

  return children;
}

function SectionalHeadRoute({ children }) {
  const { user, loading, isSectionalHead, isAdmin } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isSectionalHead && !isAdmin) return <Navigate to="/" replace />;

  return children;
}

export default function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route
              path="/login"
              element={
                <LazyRoute>
                  <Login />
                </LazyRoute>
              }
            />

            <Route
              path="/election-live"
              element={
                <LazyRoute>
                  <ElectionLiveResults />
                </LazyRoute>
              }
            />

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
                    <LazyRoute>
                      <Dashboard />
                    </LazyRoute>
                  </AdminRoute>
                }
              />

              {/* Academic Setup */}
              <Route
                path="classrooms"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <ClassroomManagement />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="subjects"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <SubjectManagement />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="terms"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <AcademicTerms />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="practice-exams"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <PracticeExams />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="setup-school-defaults"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <SetupSchoolDefaults />
                    </LazyRoute>
                  </AdminRoute>
                }
              />

              {/* Students */}
              <Route
                path="students"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <Students />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="students/by-subject"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <StudentsBySubject />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="students/classwise-list"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <ClasswiseStudentList />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="class-data-management"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <ClassDataManagement />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="class-shuffle"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <ClassShuffle />
                    </LazyRoute>
                  </AdminRoute>
                }
              />

              {/* Enrollments */}
              <Route
                path="student-subject-enrollments"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <GenerateSubjectEnrollments />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="manual-student-subject-enrollments"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <StudentSubjectEnrollments />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="migrate-student-subjects"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <MigrateStudentSubjects />
                    </LazyRoute>
                  </AdminRoute>
                }
              />

              {/* Staff */}
              <Route
                path="teachers"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <AdminTeachers />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="assignments"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <TeacherAssignments />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="class-teachers"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <ClassTeacherAssignments />
                    </LazyRoute>
                  </AdminRoute>
                }
              />

              {/* Marks & Reports */}
              <Route
                path="marks"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <MarksEntry />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="sba"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <SBAForm />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="marks-upload"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <BulkMarksUpload />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="teacher-mark-sheets"
                element={
                  <ReportAccessRoute>
                    <LazyRoute>
                      <TeacherMarkSheets />
                    </LazyRoute>
                  </ReportAccessRoute>
                }
              />
              <Route
                path="class-marks-reports"
                element={
                  <ReportAccessRoute>
                    <LazyRoute>
                      <ClassMarksReports />
                    </LazyRoute>
                  </ReportAccessRoute>
                }
              />
              <Route
                path="class-completion-report"
                element={
                  <ReportAccessRoute>
                    <LazyRoute>
                      <ClassCompletionReport />
                    </LazyRoute>
                  </ReportAccessRoute>
                }
              />
              <Route
                path="subject-analysis"
                element={
                  <ReportAccessRoute>
                    <LazyRoute>
                      <SubjectAnalysis />
                    </LazyRoute>
                  </ReportAccessRoute>
                }
              />
              <Route
                path="report/:studentId"
                element={
                  <ReportAccessRoute>
                    <LazyRoute>
                      <ReportCard />
                    </LazyRoute>
                  </ReportAccessRoute>
                }
              />

              {/* Promotion & Tools */}
              <Route
                path="promotion"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <YearEndPromotion />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="export-firestore-samples"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <ExportFirestoreSamples />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="election-count"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <ElectionCount />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="student-parliament-election"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <ElectionCount />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
            </Route>

            {/* Sectional Head Layout */}
            <Route
              path="/sectional-head"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route
                index
                element={
                  <SectionalHeadRoute>
                    <LazyRoute>
                      <SectionalHeadDashboard />
                    </LazyRoute>
                  </SectionalHeadRoute>
                }
              />
              <Route
                path="class-marks-reports"
                element={
                  <SectionalHeadRoute>
                    <LazyRoute>
                      <ClassMarksReports />
                    </LazyRoute>
                  </SectionalHeadRoute>
                }
              />
              <Route
                path="class-completion-report"
                element={
                  <SectionalHeadRoute>
                    <LazyRoute>
                      <ClassCompletionReport />
                    </LazyRoute>
                  </SectionalHeadRoute>
                }
              />
              <Route
                path="subject-analysis"
                element={
                  <SectionalHeadRoute>
                    <LazyRoute>
                      <SubjectAnalysis />
                    </LazyRoute>
                  </SectionalHeadRoute>
                }
              />
              <Route
                path="classwise-list"
                element={
                  <SectionalHeadRoute>
                    <LazyRoute>
                      <ClasswiseStudentList />
                    </LazyRoute>
                  </SectionalHeadRoute>
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
                    <LazyRoute>
                      <TeacherDashboard />
                    </LazyRoute>
                  </TeacherRoute>
                }
              />

              <Route
                path="marks"
                element={
                  <TeacherRoute>
                    <LazyRoute>
                      <MarksEntry />
                    </LazyRoute>
                  </TeacherRoute>
                }
              />

              <Route
                path="sba"
                element={
                  <TeacherRoute>
                    <LazyRoute>
                      <SBAForm />
                    </LazyRoute>
                  </TeacherRoute>
                }
              />

              <Route
                path="class-report"
                element={
                  <TeacherRoute>
                    <LazyRoute>
                      <ClassReport />
                    </LazyRoute>
                  </TeacherRoute>
                }
              />

              <Route
                path="report/:studentId"
                element={
                  <TeacherRoute>
                    <LazyRoute>
                      <ReportCard />
                    </LazyRoute>
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
