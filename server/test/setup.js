import fs from "fs-extra";
import path from "path";

const serverConfigDir = path.resolve(process.cwd(), "config");
const appConfigDir = path.resolve(process.cwd(), "app/config");

process.env.NODE_ENV = "test";

// for logSettings.js
fs.mkdirSync(serverConfigDir, { recursive: true });
fs.writeJsonSync(path.resolve(serverConfigDir, "log.json"), {
  appenders: {
    stdout: {
      type: "stdout"
    }
  },
  categories: {
    default: {
      appenders: ["stdout"],
      level: "off"
    }
  }
});

// for db.js
fs.mkdirSync(appConfigDir, { recursive: true });
fs.writeJsonSync(path.resolve(appConfigDir, "remotehost.json"), []);
fs.writeJsonSync(path.resolve(appConfigDir, "server.json"), {});
fs.writeJsonSync(path.resolve(appConfigDir, "jobScheduler.json"), {});
fs.writeJsonSync(path.resolve(appConfigDir, "jobScriptTemplate.json"), []);
fs.writeJsonSync(path.resolve(appConfigDir, "projectList.json"), []);
fs.writeJsonSync(path.resolve(appConfigDir, "credentials.json"), {});
fs.writeFileSync(path.resolve(appConfigDir, "server.key"), "dummy key");
fs.writeFileSync(path.resolve(appConfigDir, "server.crt"), "dummy crt");

export const mochaHooks = {
  async afterAll() {
    await fs.remove(serverConfigDir);
    await fs.remove(appConfigDir);
  }
};