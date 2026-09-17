const { spawnSync } = require("node:child_process");

const emulatorEnv = {
  ...process.env,
  CI: "true",
  REACT_APP_FIREBASE_API_KEY: "demo-api-key",
  REACT_APP_FIREBASE_AUTH_DOMAIN: "demo-kilinochchi-rules.firebaseapp.com",
  REACT_APP_FIREBASE_PROJECT_ID: "demo-kilinochchi-rules",
  REACT_APP_FIREBASE_STORAGE_BUCKET: "demo-kilinochchi-rules.appspot.com",
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  REACT_APP_FIREBASE_APP_ID: "1:000000000000:web:emulator",
  REACT_APP_USE_FIREBASE_EMULATORS: "true",
  REACT_APP_FIREBASE_EMULATOR_HOST: "127.0.0.1",
  REACT_APP_FIRESTORE_EMULATOR_PORT: "8085",
  REACT_APP_AUTH_EMULATOR_PORT: "9099",
  REACT_APP_ENABLE_CANONICAL_SCOPED_READS: "false",
};

const result = spawnSync(process.execPath, [require.resolve("react-scripts/scripts/build.js")], {
  env: emulatorEnv,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
