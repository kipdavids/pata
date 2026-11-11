/**
 * Capture Product Hunt gallery shots from a local production build.
 *
 *   npm run build && npm start -- -p 3100
 *   node scripts/shoot.mjs
 *
 * Drives two real browsers over the Chrome DevTools Protocol: one creates and
 * plays a match, the other joins it. No extra dependencies — Chrome/Edge ships
 * the protocol, Node ships the WebSocket.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = path.join(process.cwd(), "launch", "gallery");
const W = 1270;
const H = 760;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readEnv() {
  const text = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

/**
 * Supabase rate-limits anonymous sign-ins per IP, which makes repeated
 * captures fail. Two fixed demo accounts, signed in with a password, keep the
 * script (and the leaderboard) stable across runs.
 */
async function demoSession(env, email, password) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;

  await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  }).catch(() => null);

  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const session = await login.json();
  if (!session.access_token) {
    throw new Error(`demo sign-in failed: ${JSON.stringify(session).slice(0, 200)}`);
  }

  return {
    access_token: session.access_token,
    token_type: session.token_type ?? "bearer",
    expires_in: session.expires_in,
    expires_at:
      session.expires_at ?? Math.round(Date.now() / 1000) + session.expires_in,
    refresh_token: session.refresh_token,
    user: session.user,
  };
}

class Tab {
  constructor({ name, port, width, height, mobile }) {
    this.name = name;
    this.port = port;
    this.width = width;
    this.height = height;
    this.mobile = mobile;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
  }

  async start() {
    const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
    if (!chrome) throw new Error("No Chrome or Edge binary found");
    // Profiles persist between runs so the guest session (and its
    // server-side identity) survives. Supabase rate-limits anonymous sign-ins.
    this.profile = path.join(process.env.TEMP ?? "/tmp", `pata-shoot-${this.port}`);
    await mkdir(this.profile, { recursive: true });

    this.child = spawn(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--remote-allow-origins=*",
        `--remote-debugging-port=${this.port}`,
        `--user-data-dir=${this.profile}`,
        `--window-size=${this.width},${this.height}`,
        "about:blank",
      ],
      { stdio: "ignore" },
    );

    let target;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const list = await fetch(`http://127.0.0.1:${this.port}/json/list`).then(
          (res) => res.json(),
        );
        target = list.find((entry) => entry.type === "page");
        if (target) break;
      } catch {
        // Chrome is still starting.
      }
      await sleep(100);
    }
    if (!target) throw new Error(`${this.name}: could not attach to Chrome`);

    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method) {
        this.events.push(message.method);
      }
    });

    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Emulation.setDeviceMetricsOverride", {
      width: this.width,
      height: this.height,
      deviceScaleFactor: 2,
      mobile: Boolean(this.mobile),
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 20000);
    });
  }

  async eval(expression, { async = false } = {}) {
    const wrapper = async
      ? `(async () => { ${expression} })()`
      : `(() => { ${expression} })()`;
    const result = await this.send("Runtime.evaluate", {
      expression: wrapper,
      awaitPromise: async,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        `${this.name}: ${result.exceptionDetails.exception?.description ?? expression}`,
      );
    }
    return result.result.value;
  }

  async goto(url) {
    await this.send("Page.navigate", { url });
    await sleep(400);
    await this.waitFor("return document.readyState === 'complete'");
    await sleep(600);
  }

  async waitFor(expression, { timeout = 20000, label = expression } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await this.eval(expression).catch(() => false)) return true;
      await sleep(150);
    }
    throw new Error(`${this.name}: timed out waiting for ${label}`);
  }

  async clickText(text, { selector = "button, a" } = {}) {
    const clicked = await this.eval(`
      const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const hit = nodes.find((node) => {
        const label = (node.textContent || "").trim().toLowerCase();
        const aria = (node.getAttribute("aria-label") || "").toLowerCase();
        return label === ${JSON.stringify(text.toLowerCase())} ||
          aria === ${JSON.stringify(text.toLowerCase())};
      });
      if (!hit) return false;
      hit.click();
      return true;
    `);
    if (!clicked) throw new Error(`${this.name}: no element labelled "${text}"`);
    await sleep(350);
  }

  async clickContains(text) {
    const clicked = await this.eval(`
      const nodes = [...document.querySelectorAll("button, a")];
      const hit = nodes.find((node) =>
        (node.textContent || "").trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
      if (!hit) return false;
      hit.click();
      return true;
    `);
    if (!clicked) throw new Error(`${this.name}: no element containing "${text}"`);
    await sleep(350);
  }

  async fill(selector, value) {
    await this.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      ).set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    `);
    await sleep(150);
  }

  async clickCell(number) {
    const clicked = await this.eval(`
      const cells = [...document.querySelectorAll("button")];
      const hit = cells.find((cell) =>
        (cell.getAttribute("aria-label") || "") === "Number ${number}");
      if (!hit || hit.disabled) return false;
      hit.click();
      return true;
    `);
    if (!clicked) throw new Error(`${this.name}: number ${number} is not playable`);
    await sleep(300);
  }

  async text() {
    return this.eval("return document.body.innerText;");
  }

  async shot(file, { zoom = 1 } = {}) {
    if (zoom !== 1) {
      await this.eval(
        `document.body.style.zoom = ${JSON.stringify(String(zoom))}; return true;`,
      );
      await sleep(250);
    }
    const { data } = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      optimizeForSpeed: true,
    });
    if (zoom !== 1) {
      await this.eval('document.body.style.zoom = ""; return true;');
    }
    const raw = Buffer.from(data, "base64");
    await sharp(raw)
      .resize(W, H, { fit: "cover", position: "top" })
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(path.join(OUT, file));
    console.log(`shot ${file}`);
  }

  async shotNative(file) {
    const { data } = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      optimizeForSpeed: true,
    });
    await sharp(Buffer.from(data, "base64"))
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(path.join(OUT, file));
    console.log(`shot ${file}`);
  }

  async stop() {
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.child?.kill();
    await sleep(300);
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const ada = new Tab({ name: "host", port: 9333, width: W, height: H });
  const bram = new Tab({ name: "guest", port: 9334, width: W, height: H });

  try {
    await Promise.all([ada.start(), bram.start()]);

    // Clean slate: a known name and no install banner over the screenshots.
    // Seed each browser with a signed-in demo session (see demoSession).
    const env = await readEnv();
    const storageKey = `sb-${new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
    const [hostSession, guestSession] = await Promise.all([
      demoSession(env, "shots-host@pata.test", "pata-shots-2026"),
      demoSession(env, "shots-guest@pata.test", "pata-shots-2026"),
    ]);

    const prepare = async (tab, session) => {
      await tab.goto(`${BASE}/`);
      await tab.eval(`
        localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(JSON.stringify(session))});
        localStorage.setItem("pata:install-dismissed", "1");
        return true;
      `);
      await tab.goto(`${BASE}/`);
      await tab.waitFor("return !!document.querySelector('#display-name')");
      await tab.waitFor(
        "return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))",
        { label: `${tab.name} session` },
      );
      await sleep(1000);
    };

    // The server names new guests "Player 1a2b3c", so set the profile name
    // through the same API the UI uses, then reload to pick it up.
    const profileName = async (tab, name) => {
      const result = await tab.eval(`
        const key = Object.keys(localStorage).find(
          (item) => item.startsWith("sb-") && item.endsWith("-auth-token"),
        );
        if (!key) return { ok: false, reason: "no session" };
        let raw = localStorage.getItem(key);
        if (raw && raw.startsWith("base64-")) raw = atob(raw.slice(7));
        const session = JSON.parse(raw);
        const response = await fetch("/api/profile", {
          method: "PUT",
          headers: {
            Authorization: "Bearer " + session.access_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ displayName: ${JSON.stringify(name)} }),
        });
        return { ok: response.ok, status: response.status };
      `, { async: true });
      if (!result?.ok) {
        throw new Error(`${tab.name}: profile rename failed ${JSON.stringify(result)}`);
      }
    };

    await Promise.all([prepare(ada, hostSession), prepare(bram, guestSession)]);
    await Promise.all([profileName(ada, "Wanjiku"), profileName(bram, "Otieno")]);
    await Promise.all([ada.goto(`${BASE}/`), bram.goto(`${BASE}/`)]);
    await Promise.all([
      ada.waitFor("return document.querySelector('#display-name')?.value === 'Wanjiku'", {
        label: "host name",
      }),
      bram.waitFor("return document.querySelector('#display-name')?.value === 'Otieno'", {
        label: "guest name",
      }),
    ]);

    // --- Host creates a match -------------------------------------------
    await ada.clickContains("5each");
    const fiveTurns = await ada.eval(`
      const button = [...document.querySelectorAll("button")].find((node) =>
        (node.textContent || "").trim().replace("✓", "") === "5each");
      return button ? button.getAttribute("aria-pressed") : null;
    `);
    if (fiveTurns !== "true") throw new Error("could not select 5 turns");
    await ada.clickContains("create match");
    await ada.waitFor("return location.pathname.startsWith('/match/')", {
      label: "match route",
    });
    await sleep(1500);
    const code = await ada.eval("return location.pathname.split('/').pop();");
    console.log("match code", code);
    await ada.shot("03-invite.png");

    // --- Guest joins -----------------------------------------------------
    await bram.goto(`${BASE}/match/${code}`);
    await bram.waitFor(
      "return document.body.innerText.toLowerCase().includes('join this match')",
      { label: "join button" },
    );
    await sleep(700);
    await bram.clickText("Join this match");
    await sleep(1500);

    // --- Play a short match, capturing the interesting states -----------
    const canPick = async (tab) =>
      tab.eval(
        "return document.body.innerText.toLowerCase().includes('pick a number to hide')",
      );

    async function findChooser() {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (await canPick(ada)) return ada;
        if (await canPick(bram)) return bram;
        await sleep(200);
      }
      throw new Error("no side was asked to pick a number");
    }

    const firstChooser = await findChooser();
    console.log(`${firstChooser.name} chooses first`);

    await sleep(500);
    await firstChooser.shot("04-choose.png", { zoom: 0.64 });

    // Alternates automatically, so the script follows the real role swap.
    const picks = [47, 8, 92, 23, 61, 15, 78, 34, 56, 3];

    for (let turn = 0; turn < picks.length; turn += 1) {
      const pick = picks[turn];
      const chooser = await findChooser();
      const finder = chooser === ada ? bram : ada;

      await chooser.clickCell(pick);
      await finder.waitFor("return document.body.innerText.includes('Find')", {
        label: `hunt ${turn + 1}`,
      });

      if (turn === 0) {
        // Shoot straight away so the clock reads like a real hunt.
        await finder.shot("05-hunt.png", { zoom: 0.64 });
        await chooser.shot("06-hunt-in-progress.png", { zoom: 0.64 });
      } else {
        await sleep(300);
      }

      await finder.clickCell(pick);

      if (turn === 1) {
        // Turn 2 is the first find that raises a toast (turn 1 is the
        // "first sight" exemption), so capture the settled clock here.
        await chooser.waitFor(
          "return [...document.querySelectorAll('div')].some((node) => node.className.includes('animate-slide-down') && node.className.includes('fixed'))",
          { label: "find toast" },
        );
        await chooser.shot("07-after-find.png", { zoom: 0.64 });
        await sleep(3300);
      } else {
        await sleep(900);
      }
    }

    // --- Result and leaderboard -----------------------------------------
    await ada.waitFor(
      "return document.body.innerText.toLowerCase().includes('play again')",
      { label: "match result" },
    );
    // Let the final find toast fade so it does not sit over the header.
    await sleep(4200);
    await ada.shot("08-result.png");

    // --- Lobby, now that it has real stats ------------------------------
    await ada.goto(`${BASE}/`);
    await ada.waitFor(
      "return /[1-9]\\d* matches/.test(document.body.innerText)",
      { label: "lobby stats" },
    );
    await sleep(1200);
    await ada.shot("01-lobby.png");

    await ada.eval(`
      const hit = [...document.querySelectorAll("button")].find((n) =>
        (n.getAttribute("aria-label") || "").toLowerCase().includes("how"));
      if (hit) hit.click();
      return !!hit;
    `);
    await sleep(700);
    await ada.shot("02-how-to-play.png");
    await ada.eval(`
      const hit = [...document.querySelectorAll("button")].find((n) =>
        (n.getAttribute("aria-label") || "").toLowerCase() === "close");
      if (hit) hit.click();
      return !!hit;
    `);

    await ada.goto(`${BASE}/leaderboard`);
    await sleep(1500);
    await ada.shot("09-leaderboard.png");

    // --- Phone ----------------------------------------------------------
    const phone = new Tab({
      name: "phone",
      port: 9335,
      width: 390,
      height: 844,
      mobile: true,
    });
    try {
      await phone.start();
      await phone.goto(`${BASE}/`);
      await phone.eval(`
        localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(JSON.stringify(hostSession))});
        localStorage.setItem("pata:install-dismissed", "1");
        return true;
      `);
      await phone.goto(`${BASE}/`);
      await phone.waitFor(
        "return /[1-9]\\d* matches/.test(document.body.innerText)",
        { label: "phone stats" },
      );
      await sleep(1200);
      await phone.shotNative("10-phone-lobby.png");

      await phone.goto(`${BASE}/match/${code}`);
      await sleep(1600);
      await phone.shotNative("11-phone-result.png");
    } finally {
      await phone.stop();
    }
  } finally {
    await Promise.all([ada.stop(), bram.stop()]);
  }

  console.log("done ->", OUT);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
