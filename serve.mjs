import { spawn } from "node:child_process";
import { join } from "node:path";

console.log("==================================================");
console.log(" 🚀 AegisAI Platform Unified Launcher");
console.log("==================================================\n");

const PROJECT = process.cwd();

function runProcess(name, command, args, cwd) {
  console.log(`[STARTING] ${name}...`);
  const proc = spawn(command, args, { cwd, shell: true, stdio: "pipe" });

  proc.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (line) console.log(`[${name}] ${line}`);
    }
  });

  proc.stderr.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (line) console.error(`[${name}] ${line}`);
    }
  });

  proc.on("error", (err) => console.error(`[${name} ERROR]`, err.message));
  return proc;
}

// 1. PostgreSQL (Start and let it background)
runProcess("Database", '"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_ctl.exe"', ["start", "-D", `"${join(PROJECT, ".pgdata")}"`, "-o", "\"-p 5433\"", "-s"], PROJECT);

setTimeout(() => {
  // 2. MLflow
  runProcess("MLflow", "mlflow", ["server", "--host", "127.0.0.1", "--port", "5001", "--backend-store-uri", "sqlite:///mlflow.db"], PROJECT);
}, 2000);

setTimeout(() => {
  // 3. Backend API
  runProcess("API", "pnpm", ["--filter", "@workspace/api-server", "run", "dev"], PROJECT);
}, 4000);

setTimeout(() => {
  // 4. Frontend UI
  runProcess("Frontend", "npx", ["vite", "--config", "vite.config.ts", "--host", "0.0.0.0"], join(PROJECT, "artifacts/aegisai"));
  
  console.log("\n==================================================");
  console.log(" 🌐 ALL SERVICES STARTING!");
  console.log(" 👉 Open your browser to: http://localhost:5173");
  console.log("==================================================\n");
}, 7000);
