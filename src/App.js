import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Box, CssBaseline, LinearProgress, Skeleton, Stack, ThemeProvider, Typography } from "@mui/material";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { COLOR_MODES, createAppTheme } from "./theme/appTheme";
import { ColorModeContext } from "./theme/ColorModeContext";

import Layout from "./components/Layout";
import PageMeta from "./components/PageMeta";
import MaintenanceGate from "./components/MaintenanceGate";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const SectionalHeadDashboard = lazy(() => import("./pages/SectionalHeadDashboard"));
const AccountLogin = lazy(() => import("./pages/AccountLogin"));

const ClassroomManagement = lazy(() => import("./pages/ClassroomManagement"));
const SubjectManagement = lazy(() => import("./pages/SubjectManagement"));
const AcademicTerms = lazy(() => import("./pages/AcademicTerms"));
const PracticeExams = lazy(() => import("./pages/PracticeExams"));
const SetupSchoolDefaults = lazy(() => import("./pages/SetupSchoolDefaults"));

const Students = lazy(() => import("./pages/Students"));
const StudentAccounts = lazy(() => import("./pages/StudentAccounts"));
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
const AttendanceRegister = lazy(() => import("./pages/AttendanceRegister"));
const GradeResultSheet = lazy(() => import("./pages/GradeResultSheet"));
const ReportCard = lazy(() => import("./pages/ReportCard"));
const ClassReport = lazy(() => import("./pages/ClassReport"));
const ClassMarksReports = lazy(() => import("./pages/reports/ClassMarksReports"));
const ClassCompletionReport = lazy(() => import("./pages/reports/ClassCompletionReport"));
const TextBookRequestReport = lazy(() => import("./pages/reports/TextBookRequestReport"));
const SubjectAnalysis = lazy(() => import("./pages/SubjectAnalysis"));

const YearEndPromotion = lazy(() => import("./pages/YearEndPromotion"));
const ExportFirestoreSamples = lazy(() => import("./pages/ExportFirestoreSamples"));
const SBAForm = lazy(() => import("./pages/SBAForm"));
const SBAMarks = lazy(() => import("./pages/SBAMarks"));
const ElectionCount = lazy(() => import("./pages/ElectionCount"));
const ElectionLiveResults = lazy(() => import("./pages/ElectionLiveResults"));
const MarksStatusLive = lazy(() => import("./pages/MarksStatusLive"));
const PrefectLogin = lazy(() => import("./pages/PrefectLogin"));
const PrefectDashboard = lazy(() => import("./pages/PrefectDashboard"));
const AcademicDataHealth = lazy(() => import("./pages/AcademicDataHealth"));

function LoadingScreen({ workspace = false }) {
  return (
    <Box
      sx={{
        minHeight: workspace ? { xs: 360, md: 480 } : "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Box
        role="status"
        aria-live="polite"
        sx={{
          width: "100%",
          maxWidth: 360,
          p: { xs: 2, sm: 2.5 },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          bgcolor: "background.paper",
          boxShadow: 2,
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box sx={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 1.5, bgcolor: "primary.lighter", color: "primary.main" }}>
              <SchoolRoundedIcon />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={800}>
                Kilinochchi Marks
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {workspace ? "Loading page..." : "Preparing your workspace..."}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width="34%" height={34} />
            <Skeleton variant="rounded" width="66%" height={34} />
          </Stack>
          <LinearProgress sx={{ borderRadius: 999 }} />
        </Stack>
      </Box>
    </Box>
  );
}

function LazyRoute({ children }) {
  return <Suspense fallback={<LoadingScreen workspace />}>{children}</Suspense>;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin, isAccount, isSectionalHead } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (isAccount) return <Navigate to="/accounts" replace />;
  if (!isAdmin) return <Navigate to={isSectionalHead ? "/sectional-head" : "/teacher"} replace />;

  return children;
}

function AccountRoute({ children }) {
  const { user, loading, isAdmin, isAccount } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/accounts-login" replace />;
  if (!isAdmin && !isAccount) {
    return <Navigate to="/login" replace />;
  }

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

function PrefectRoute({ children }) {
  const { user, loading, isPrefect, isAdmin } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/prefect-login" replace />;
  if (!isPrefect && !isAdmin) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [colorMode, setColorModeState] = useState(() => {
    const savedMode = window.localStorage.getItem("kcc-color-mode");
    if (Object.values(COLOR_MODES).includes(savedMode)) return savedMode;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? COLOR_MODES.DARK
      : COLOR_MODES.LIGHT;
  });

  const appTheme = useMemo(() => createAppTheme(colorMode), [colorMode]);

  const setColorMode = (nextMode) => {
    if (!Object.values(COLOR_MODES).includes(nextMode)) return;
    setColorModeState(nextMode);
    window.localStorage.setItem("kcc-color-mode", nextMode);
  };

  const cycleColorMode = () => {
    const modeOrder = [COLOR_MODES.LIGHT, COLOR_MODES.DARK, COLOR_MODES.CONTRAST];
    const currentIndex = modeOrder.indexOf(colorMode);
    setColorMode(modeOrder[(currentIndex + 1) % modeOrder.length]);
  };

  useEffect(() => {
    document.documentElement.dataset.colorMode = colorMode;
  }, [colorMode]);

  return (
    <ColorModeContext.Provider
      value={{ mode: colorMode, setMode: setColorMode, cycleMode: cycleColorMode }}
    >
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
          <PageMeta />
          <MaintenanceGate>
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
              path="/prefect-login"
              element={<LazyRoute><PrefectLogin /></LazyRoute>}
            />
            <Route
              path="/accounts-login"
              element={<LazyRoute><AccountLogin /></LazyRoute>}
            />
            <Route
              path="/accounts"
              element={
                <AccountRoute>
                  <LazyRoute><StudentAccounts /></LazyRoute>
                </AccountRoute>
              }
            />
            <Route
              path="/prefect"
              element={
                <PrefectRoute>
                  <LazyRoute><PrefectDashboard /></LazyRoute>
                </PrefectRoute>
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
            <Route
              path="/marks-status-live"
              element={
                <LazyRoute>
                  <MarksStatusLive />
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
              <Route path="sba-marks" element={<AdminRoute><LazyRoute><SBAMarks /></LazyRoute></AdminRoute>} />
              <Route path="sba-register" element={<AdminRoute><LazyRoute><SBAMarks registerMode /></LazyRoute></AdminRoute>} />
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
                path="attendance-register"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <AttendanceRegister />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route
                path="grade-result-sheet"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <GradeResultSheet />
                    </LazyRoute>
                  </AdminRoute>
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
                path="text-book-request"
                element={
                  <ReportAccessRoute>
                    <LazyRoute>
                      <TextBookRequestReport />
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
                path="backup-restore"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <ExportFirestoreSamples />
                    </LazyRoute>
                  </AdminRoute>
                }
              />
              <Route path="export-firestore-samples" element={<Navigate to="/backup-restore" replace />} />
              <Route
                path="academic-data-health"
                element={
                  <AdminRoute>
                    <LazyRoute>
                      <AcademicDataHealth />
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
              <Route path="sba-marks" element={<TeacherRoute><LazyRoute><SBAMarks /></LazyRoute></TeacherRoute>} />
              <Route path="sba-register" element={<TeacherRoute><LazyRoute><SBAMarks registerMode /></LazyRoute></TeacherRoute>} />
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
          </MaintenanceGate>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
