(() => {
  // ========= Helpers =========
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function scrollToBottom() {
    const out = $("output");
    out.scrollTop = out.scrollHeight;
  }

  // ========= Minimal ANSI SGR parser =========
  // Supports: 0,1,3,4,24, 30-37,90-97, 40-47,100-107, 38;5;N, 48;5;N
  // Converts to <span style="...">...</span>
  function ansiToHtml(input) {
    const ESC = "\x1b";
    const re = new RegExp(`${ESC}\\[([0-9;]*)m`, "g");

    let html = "";
    let lastIndex = 0;

    let state = {
      bold: false,
      italic: false,
      underline: false,
      fg: null,     // css color
      bg: null      // css color
    };

    function cssFromState() {
      const css = [];
      if (state.bold) css.push("font-weight:700");
      if (state.italic) css.push("font-style:italic");
      if (state.underline) css.push("text-decoration:underline");
      if (state.fg) css.push(`color:${state.fg}`);
      if (state.bg) css.push(`background-color:${state.bg}`);
      return css.join(";");
    }

    function openSpan() {
      const css = cssFromState();
      return css ? `<span style="${css}">` : `<span>`;
    }

    function color16(code, bright = false) {
      // ANSI standard-ish palette; browser will approximate
      const base = bright
        ? ["#767676","#ff6b6b","#51cf66","#ffd43b","#339af0","#da77f2","#22b8cf","#f1f3f5"]
        : ["#000000","#e03131","#2f9e44","#f08c00","#1971c2","#9c36b5","#0c8599","#f8f9fa"];
      return base[code] ?? null;
    }

    function color256(n) {
      // xterm 256-color approximation
      if (n < 16) {
        // map first 16 to something reasonable
        const map = [
          "#000000","#800000","#008000","#808000","#000080","#800080","#008080","#c0c0c0",
          "#808080","#ff0000","#00ff00","#ffff00","#0000ff","#ff00ff","#00ffff","#ffffff"
        ];
        return map[n] || null;
      }
      if (n >= 16 && n <= 231) {
        const idx = n - 16;
        const r = Math.floor(idx / 36);
        const g = Math.floor((idx % 36) / 6);
        const b = idx % 6;
        const steps = [0, 95, 135, 175, 215, 255];
        return `rgb(${steps[r]},${steps[g]},${steps[b]})`;
      }
      if (n >= 232 && n <= 255) {
        const v = 8 + (n - 232) * 10;
        return `rgb(${v},${v},${v})`;
      }
      return null;
    }

    function applyCodes(codes) {
      if (!codes.length) codes = [0];

      for (let i = 0; i < codes.length; i++) {
        const c = codes[i];

        if (c === 0) {
          state = { bold:false, italic:false, underline:false, fg:null, bg:null };
          continue;
        }
        if (c === 1) { state.bold = true; continue; }
        if (c === 3) { state.italic = true; continue; }
        if (c === 4) { state.underline = true; continue; }
        if (c === 24) { state.underline = false; continue; }

        // FG 30-37 / 90-97
        if (c >= 30 && c <= 37) { state.fg = color16(c - 30, false); continue; }
        if (c >= 90 && c <= 97) { state.fg = color16(c - 90, true); continue; }

        // BG 40-47 / 100-107
        if (c >= 40 && c <= 47) { state.bg = color16(c - 40, false); continue; }
        if (c >= 100 && c <= 107) { state.bg = color16(c - 100, true); continue; }

        // 38;5;n (FG 256)
        if (c === 38 && codes[i+1] === 5 && typeof codes[i+2] === "number") {
          state.fg = color256(codes[i+2]);
          i += 2;
          continue;
        }
        // 48;5;n (BG 256)
        if (c === 48 && codes[i+1] === 5 && typeof codes[i+2] === "number") {
          state.bg = color256(codes[i+2]);
          i += 2;
          continue;
        }
      }
    }

    // Build HTML by segments
    let spanOpen = false;
    function pushText(txt) {
      if (!txt) return;
      const safe = escapeHtml(txt);
      if (!spanOpen) {
        html += openSpan();
        spanOpen = true;
      }
      html += safe;
    }

    let m;
    while ((m = re.exec(input)) !== null) {
      const chunk = input.slice(lastIndex, m.index);
      pushText(chunk);

      // close current span and open a new one after applying codes
      if (spanOpen) { html += "</span>"; spanOpen = false; }

      const codes = (m[1] || "0")
        .split(";")
        .filter(x => x.length)
        .map(x => Number(x));

      applyCodes(codes);

      lastIndex = re.lastIndex;
    }

    pushText(input.slice(lastIndex));
    if (spanOpen) html += "</span>";

    return `<span class="ansi">${html}</span>`;
  }

  // ========= Fake FS =========
  // Nodes: { type: 'dir'|'file', children?, content? }
  const FS = {
    "/": { type: "dir", children: ["void"] },
    "/void": { type: "dir", children: ["eventos"] },
    "/void/eventos": { type: "dir", children: ["event.sh", "void_styles.sh"] },
    "/void/eventos/void_styles.sh": { type: "file", content:
`# (ficticio) void_styles.sh
# Contiene variables con códigos ANSI; en la web se simula el efecto al ejecutar event.sh.

style_RESET=$'\\e[0m'
style_BOLD=$'\\e[1m'
style_ITALIC=$'\\e[3m'
style_UNDERLINE=$'\\e[4m'
style_NO_UNDERLINE=$'\\e[24m'

style_RED=$'\\e[31m'
style_GREEN=$'\\e[32m'
style_YELLOW=$'\\e[33m'
style_BLUE=$'\\e[34m'
style_CYAN=$'\\e[36m'

style_BRIGHT_RED=$'\\e[91m'
style_BRIGHT_GREEN=$'\\e[92m'
style_BRIGHT_BLUE=$'\\e[94m'
style_BRIGHT_CYAN=$'\\e[96m'

style_ORANGE=$'\\e[38;5;208m'
`},
    "/void/eventos/event.sh": { type: "file", content:
`#!/bin/bash
#########

source ./_styles.sh

echo
echo
text "\${style_BOLD}\${style_BRIGHT_BLUE}" "────── EVENTO ──────"
echo
# 🗓  ⏲  🌐
text "\${style_BRIGHT_RED}"   "Fecha:XXX   "
text "\${style_BRIGHT_GREEN}" "Hora: XXX    "
text "\${style_BRIGHT_CYAN}"  "Lugar: XXXX  "

text "\${style_BOLD}\${style_BRIGHT_BLUE}" "────────────────────"
`}
  };

  function normPath(p) {
    // Normalize like a very small subset of bash path rules
    if (!p) return "/";
    p = p.trim();
    if (!p.startsWith("/")) return p; // will be resolved relative by caller
    // remove trailing slash except root
    if (p.length > 1) p = p.replace(/\/+$/g, "");
    return p || "/";
  }

  function resolvePath(cwd, arg) {
    arg = (arg ?? "").trim();
    if (!arg || arg === ".") return cwd;
    if (arg === "/") return "/";
    if (arg.startsWith("/")) return normPath(arg);

    // relative
    const parts = (cwd === "/" ? [] : cwd.split("/").filter(Boolean));
    const rel = arg.split("/").filter(Boolean);

    for (const seg of rel) {
      if (seg === ".") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return "/" + parts.join("/");
  }

  function exists(path) {
    path = normPath(path);
    return !!FS[path];
  }

  function isDir(path) {
    path = normPath(path);
    return exists(path) && FS[path].type === "dir";
  }

  function isFile(path) {
    path = normPath(path);
    return exists(path) && FS[path].type === "file";
  }

  function listDir(path) {
    path = normPath(path);
    if (!isDir(path)) return null;
    return FS[path].children || [];
  }

  function readFile(path) {
    path = normPath(path);
    if (!isFile(path)) return null;
    return FS[path].content ?? "";
  }

  // ========= Terminal state =========
  const state = {
    user: "user",
    host: "web",
    cwd: "/void",
    history: [],
    histIdx: -1
  };

  function promptText() {
    return `${state.user}@${state.host}:${state.cwd}$`;
  }

  function setPrompt() {
    $("prompt").textContent = promptText() + " ";
  }

  function printLine(raw, { ansi = false } = {}) {
    const out = $("output");
    const div = document.createElement("div");
    div.className = "line";
    div.innerHTML = ansi ? ansiToHtml(raw) : escapeHtml(raw);
    out.appendChild(div);
    scrollToBottom();
  }

  function printCommandEcho(cmd) {
    printLine(`${promptText()} ${cmd}`);
  }

  // ========= Built-in commands =========
  function cmdHelp() {
    printLine(
`Comandos disponibles:
  help                Muestra esta ayuda
  pwd                 Muestra el directorio actual
  ls [ruta]            Lista contenido (solo FS ficticio)
  cd <ruta>            Cambia de directorio
  cat <archivo>        Muestra contenido de archivo
  ./event.sh           Ejecuta el script ficticio (con ANSI)
  bash event.sh        Igual que ./event.sh
  clear               Limpia la pantalla

Todo comando no definido: "Sistema limitado"`
    );
  }

  function cmdPwd() {
    printLine(state.cwd);
  }

  function cmdLs(args) {
    const target = args?.length ? resolvePath(state.cwd, args[0]) : state.cwd;
    if (!exists(target)) {
      printLine(`ls: no existe: ${target}`);
      return;
    }
    if (isFile(target)) {
      // If ls file -> show file name
      const name = target.split("/").pop();
      printLine(name);
      return;
    }
    const items = listDir(target) || [];
    if (!items.length) {
      printLine("");
      return;
    }
    // simple output, one per space
    printLine(items.join("  "));
  }

  function cmdCd(args) {
    const arg = args?.[0] ?? "";
    if (!arg || arg === "~") {
      // Home in this toy shell = /void
      state.cwd = "/void";
      setPrompt();
      return;
    }
    const target = resolvePath(state.cwd, arg);
    if (!exists(target)) {
      printLine(`cd: no existe: ${target}`);
      return;
    }
    if (!isDir(target)) {
      printLine(`cd: no es un directorio: ${target}`);
      return;
    }
    state.cwd = target;
    setPrompt();
  }

  function cmdCat(args) {
    if (!args?.length) {
      printLine("cat: falta ruta de archivo");
      return;
    }
    const target = resolvePath(state.cwd, args[0]);
    if (!exists(target)) {
      printLine(`cat: no existe: ${target}`);
      return;
    }
    if (!isFile(target)) {
      printLine(`cat: no es un archivo: ${target}`);
      return;
    }
    const content = readFile(target);
    // Show content as plain text (no ANSI conversion here)
    printLine(content);
  }

  function cmdClear() {
    $("output").innerHTML = "";
  }

  // ========= event.sh execution (ANSI) =========
  function runEventSh() {
    // Simulated output using real ESC codes
    const ESC = "\x1b";
    const RESET = `${ESC}[0m`;
    const BOLD = `${ESC}[1m`;
    const BR_BLUE = `${ESC}[94m`;
    const BR_RED = `${ESC}[91m`;
    const BR_GREEN = `${ESC}[92m`;
    const BR_CYAN = `${ESC}[96m`;

    // build output with blank lines like script
    const lines = [
      "",
      "",
      `${BOLD}${BR_BLUE}────── EVENTO ──────${RESET}`,
      "",
      `${BR_RED}Fecha:XXX${RESET}   ${BR_GREEN}Hora: XXX${RESET}    ${BR_CYAN}Lugar: XXXX${RESET}`,
      `${BOLD}${BR_BLUE}────────────────────${RESET}`
    ];

    // Print each as ANSI-enabled line
    for (const L of lines) printLine(L, { ansi: true });
  }

  // ========= Command parsing =========
  function tokenize(line) {
    // Minimal tokenizer: split by whitespace, respecting simple quotes "..." or '...'
    const tokens = [];
    let i = 0;
    while (i < line.length) {
      while (i < line.length && /\s/.test(line[i])) i++;
      if (i >= line.length) break;

      const ch = line[i];
      if (ch === "'" || ch === '"') {
        const q = ch;
        i++;
        let buf = "";
        while (i < line.length && line[i] !== q) {
          // no escapes here; keep it simple
          buf += line[i++];
        }
        if (i < line.length && line[i] === q) i++;
        tokens.push(buf);
      } else {
        let buf = "";
        while (i < line.length && !/\s/.test(line[i])) {
          buf += line[i++];
        }
        tokens.push(buf);
      }
    }
    return tokens;
  }

  function handleCommand(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    printCommandEcho(trimmed);

    // History
    state.history.push(trimmed);
    state.histIdx = state.history.length;

    const tokens = tokenize(trimmed);
    const cmd = tokens[0];
    const args = tokens.slice(1);

    // allow "cd /void/eventos/" etc.
    switch (cmd) {
      case "help": return cmdHelp();
      case "pwd": return cmdPwd();
      case "ls": return cmdLs(args);
      case "cd": return cmdCd(args);
      case "cat": return cmdCat(args);
      case "clear": return cmdClear();

      case "./event.sh":
        // only exists in /void/eventos, but we can resolve either way if user tries
        {
          const p = resolvePath(state.cwd, "event.sh");
          const ok = (state.cwd === "/void/eventos") && isFile("/void/eventos/event.sh");
          if (!ok) {
            // mimic "not found" rather than real perms
            printLine(`bash: ./event.sh: no se encuentra (ve a /void/eventos)`);
            return;
          }
          return runEventSh();
        }

      case "bash":
        if (args[0] === "event.sh") {
          const ok = (state.cwd === "/void/eventos") && isFile("/void/eventos/event.sh");
          if (!ok) {
            printLine(`bash: event.sh: no se encuentra (ve a /void/eventos)`);
            return;
          }
          return runEventSh();
        }
        break;

      default:
        break;
    }

    printLine("Sistema limitado");
  }

  // ========= Boot =========
  function bootBanner() {
    // Show initial info and cwd
    printLine("....");
    printLine(`Directorio actual: ${state.cwd}`);
    printLine("Escribe 'help' para ver comandos.");
    printLine("");
  }

  function bindInput() {
    const input = $("cmd");

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const v = input.value;
        input.value = "";
        handleCommand(v);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!state.history.length) return;
        state.histIdx = Math.max(0, state.histIdx - 1);
        input.value = state.history[state.histIdx] ?? "";
        // move cursor to end
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!state.history.length) return;
        state.histIdx = Math.min(state.history.length, state.histIdx + 1);
        input.value = state.histIdx === state.history.length ? "" : (state.history[state.histIdx] ?? "");
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }
      if (e.key === "Tab") {
        // keep it simple: no completion; prevent losing focus
        e.preventDefault();
      }
    });

    // Focus terminal on click
    $("terminal").addEventListener("click", () => input.focus());
    input.focus();
  }

  setPrompt();
  bootBanner();
  bindInput();
})();
