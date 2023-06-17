/* global io, jsfxr */
import { V } from "./shared.js";

let socket, state, pingInterval;
let firstLogin = !localStorage.getItem("cid");
const controlsPupupText = `Arrows = <b>Move</b><br>
  Space = <i>Empower</i><br>
  Ctrl + Arrows = <b>Move & Stop</b><br>
  Enter = Chat<br>
  <br>
  When <i>empowered</i> touch the ball to <b>shot</b> or press space again to <b>jump</b>`;
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const main = $("main"),
  info = $(".info"),
  popup = $(".popup"),
  actions = $(".ac"),
  chat = $(".c"),
  msgs = $(".c ul"),
  chatForm = $(".c form"),
  login = $(".l");

const join = (roomName = "", playersNr) => {

  clearInterval(pingInterval);

  if (socket) {
    socket.disconnect();
  }

  const name = localStorage.getItem("name");
  msgs.innerHTML = info.innerHTML = "";
  actions.classList.add("h");
  chat.classList.add("h");

  const connect = () => {

    document.body.classList.add("loading");

    socket = io({
      query: new URLSearchParams({
        name: encodeURIComponent(name),
        cid,
        room: roomName,
        v: localStorage.getItem("v") || 0,
        playersNr
      }).toString()
    });

    socket.on("connect", () => {
      console.log("socket connected");
      document.body.classList.remove("loading");
      main.classList.add("ready");
      actions.classList.remove("h");
      chat.classList.remove("h");
      main.innerHTML = "";
      play("s");
    });

    socket.on("disconnect", () => {
      main.classList.remove("ready");
      main.innerHTML = "";
    });

    socket.on("error", () => {
      main.classList.remove("ready");
      main.innerHTML = "";
    });

    socket.on("rooms", (rooms) => {
      const options = rooms.map((r) =>
        `<option value="${r.room}|!!|${r.m}">${r.room} ${r.p >= 0 ? r.p : ""}${r.m >= 0 ? ("/" + r.m) : ""}</option>`
      ).join("");
      showPopup(
        "Join a room",
        `<label>
          Select room
          <select name="r" required>
            ${options}
          </select>
        </label>`,
        true
      ).then((form) => {
        if (form) {
          const r = form.get("r").split("|!!|");
          join(r[0], r[1]);
        }
      });
    });

    socket.on("msg", (data) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="${data.team}">${data.user}:</span> ` + data.text;
      msgs.appendChild(li);
      li.animate([{ background: "#000" }, { background: "transparent" }], 3000);
    });

    pingInterval = setInterval(() => {
      const start = Date.now();
      socket.volatile.emit("ping", () => {
        const latency = Date.now() - start;
        $(".ping").innerHTML = `ping: ${latency}`;
      });
    }, 5000);

    socket.on("speak", (text) => {
      speak(text);
    });

    socket.on("stats", (stats) => {
      showPopup(
        `<h3 class="${stats.w}">${stats.t}</h3>`,
        `<table>
          <thead><tr><th>Player</th>${Object.keys(stats.p).map(e => `<th>${e}</th>`).join("")}<tr><thead>
          <tbody></tbody>
         </table>`
      );
      const rows = {};
      for (const stat in stats.p) {
        for (const player in stats.p[stat]) {
          if (!rows[player]) {
            const tr = document.createElement("tr");
            tr.classList.add(stats.p[stat][player].t);
            tr.innerHTML = `<tr>
              <td>${stats.p[stat][player].name}</td>${Object.keys(stats.p).map(e => `<td class='${e}'>0</td>`).join("")}
            </tr>`;
            rows[player] = { el: tr, vote: stats.p.vote[player].v };
          }
          const v = stats.p[stat][player].v;
          rows[player].el.querySelector("." + stat).innerHTML = stat == "vote" ? v.toFixed(2) : v;
        }
      }
      const list = [];
      for (const player in rows) {
        list.push(rows[player]);
      }
      list.sort((a, b) => b.vote - a.vote);
      list.forEach((e) => $(".popup tbody").appendChild(e.el));
    });

    socket.on("update", (upd) => {
      requestAnimationFrame(() => {
        if (!socket || !socket.connected) {
          return;
        }
        if (upd.patches) {
          upd.patches.forEach((u) => {
            const d = u.k.split(".");
            if (!state[d[0]][d[1]]) {
              state[d[0]][d[1]] = {};
            }
            state[d[0]][d[1]][d[2]] = u.v;
          });
        } else {
          state = upd;
        }
        updateState(state);
        for (const section in state) {
          for (const sprite in state[section]) {
            let el = $(`#id_${state[section][sprite].id}`);
            if (!el) {
              el = document.createElement("div");
              el.classList.add(section);
              if (section == "p") {
                if (cid == state[section][sprite].cid) {
                  el.classList.add("me");
                  const s = document.createElement("div");
                  s.classList.add("sh"); // shadow
                  el.appendChild(s);
                  blink(el, 20, 4000);
                }
              }
              el.setAttribute("id", `id_${state[section][sprite].id}`);
              main.appendChild(el);
              updateInfo(state);
            }
            if (state[section][sprite].deleted) {
              el.remove();
              if (section == "p") {
                updateInfo(state, true);
                delete state[section][sprite];
              }
            }
            for (const attr in state[section][sprite]) {
              const newVal = state[section][sprite][attr];
              const oldVal = el.dataset[attr];
              const isNew = oldVal == undefined;
              const isChanged = !isNew && ((oldVal + "") != (newVal + ""));
              on(el, state, section, sprite, attr, newVal, oldVal, isNew, isChanged);
            }
          }
        }
      });
    });

  };

  const on = (el, state, section, sprite, attr, newVal, oldVal, isNew, isChanged) => {
    if (isNew || isChanged) {
      el.style.setProperty(`--${attr}`, newVal);
      el.dataset[attr] = newVal;
      if (section == "t") {
        if (attr == "color") {
          document.body.style.setProperty(`--color-${state[section][sprite].id}`, newVal);
        }
      }
      if (section == "p") {
        if (attr == "dir" && newVal) {
          el.style.setProperty("--player-rotate", ({ u: -90, d: 90, l: 180 }[newVal] || 0) + "deg");
        }
      }
      if (section == "m") {
        if (attr == "name") {
          updateInfo(state);
        }
        if (attr == "started" || attr == "ended") {
          main.classList.toggle(attr, newVal);
          if (isChanged) {
            play("m");
            setTimeout(() => play("m", 2), 300);
            setTimeout(() => play("m", 3), 800);
          }
        }
      }
    }
    if (isChanged) {
      if (section == "t") {
        if (attr == "score") {
          blink(el, 20, 4000);
          boom(main);
          play("g");
        }
      }
      if (section == "ba") {
        const diff = Math.abs(parseInt(newVal) - parseInt(oldVal));
        el.animate([
          { transform: "scale(1)" },
          { transform: `scale(${diff <= 4 ? 1.3 : 2})` },
          { transform: "scale(1)" }
        ], 100);
        play("b" + (diff <= 4 ? "" : "l"));
      }
      if (section == "p") {
        if (attr == "px" || attr == "py") {
          if (state[section][sprite].cid == cid) {
            const t = document.createElement("div");
            t.classList.add("track");
            t.classList.add(state[section][sprite].team);
            t.style.setProperty("--px", state[section][sprite].px);
            t.style.setProperty("--py", state[section][sprite].py);
            main.appendChild(t);
            t.animate([
              { opacity: 0.5, transform: "scale(1)" },
              { opacity: 0.5, transform: "scale(0.5)" },
              { opacity: 0, transform: "scale(0.1)" }
            ], {
              delay: 200,
              duration: 1500
            }).onfinish = () => t.remove();
          }

          const diff = Math.abs(parseInt(newVal) - parseInt(oldVal));
          if (!state.m._.sleeping && diff > 3) {
            play("j", diff <= 13 ? diff - 3 : 10);
          }
        }
      }
    }
  };

  const updateInfo = (state, del) => {
    info.innerHTML = "room: " + state.m._.name +
      ` <span>${Object.keys(state.p).length - (del ? 1 : 0)}/${state.m._.maxp}</span>`;
  };

  const updateState = (s) => {
    if (typeof s.m._.time == "number") {
      const t = "" + s.m._.time;
      const arr = t.split("");
      arr.splice(t.length - 1, 0, ".");
      s.m._.time = arr.join("");
      if (s.m._.time.length == 2) {
        s.m._.time = "0" + s.m._.time;
      }
    }
  };

  const selectVehicle = () => {
    showPopup(
      "vehicle selection",
      `<div class="v">
        <div class="p me" data-info="">
          <div class="sh"></div>
        </div>
        <div class="i">
          <p data-p="shot">shot power</p>
          <p data-p="jump">jump</p>
          <p data-p="rec">energy recovery</p>
          <p data-p="hit">hit</p>
        </div>
        <div class="s">
          ${V.map((v, i) => `
            <div>
              <div><input id="v-${i}-selection" type="radio" name="v" value="${i}"></input></div>
              <label for="v-${i}-selection">${v.n}</label>
            </div>
          `).join("")}
        </div>
      </div>`
    ).then((form) => {
      const vehicle = form.get("v");
      localStorage.setItem("v", vehicle);
      connect();
    });
    $$(".v input[name='v']").forEach((el) => {
      el.addEventListener("change", (e) => {
        const index = e.target.value;
        const p = $(".v .p");
        if (p.dataset.v == index) {
          return;
        }
        play("v");
        p.dataset.v = index;
        p.dataset.name = V[index].n;
        $$(".v .i p").forEach((el) => {
          el.style.setProperty("--val", V[index][el.dataset.p]);
        });
        for (let i = 0; i < 7; i++) {
          setTimeout(() => p.dataset.info = V[index].n.split("").sort(() => 0.5 - Math.random()).join(""), i * 150);
        }
        setTimeout(() => p.dataset.info = "", 1500);
      });
      const vehicle = localStorage.getItem("v") || 0;
      if (vehicle == el.value) {
        el.click();
        el.focus();
      }
    });
  };

  if (firstLogin) {
    showPopup(
      "Welcome",
      `You are about to join a training room<br>Your goal is to put the ball on the side with your color.<br><br>
      then create a room to play with your friends`
    ).then(() => {
      firstLogin = false;
      showPopup("Controls", controlsPupupText).then(selectVehicle);
    });
  } else {
    selectVehicle();
  }

};

const blink = (el, n = 20, t = 1000) => {
  const anim = [];
  for (let x = 0; x < n; x++) {
    anim.push({ opacity: x % 2 ? 0 : 1 });
  }
  el.animate(anim, t);
};

const boom = (el, n = 20, t = 1000) => {
  const anim = [];
  for (let x = 0; x < n; x++) {
    anim.push({ transform: x % 2 ? "translateX(-4px)" : "translateX(4px)" });
  }
  el.animate(anim, t);
};

const play = (sound, time = 1) => {
  const a = new Audio();
  a.src = jsfxr({
    s: [2, , 0.6, , 0.4, 0.36, , -0.2, -0.6, 0.02, -0.7, 0.6, -0.4, 0.2, 0.01, 0.4, 0.4, -0.4, 0.9, -0.3, -0.2, 0.2, , 0.5], // start
    b: [, , , , 0.2, 0.1 + 0.3 * Math.random(), , -0.4, , , , , , 0.5, , , , , 1, , , , , 0.5], // ball touch
    bl: [2, , 0.05, , 0.2, 0.7, , -0.4, , , , , , , , , , , 1, , , , , 0.5], // ball long touch
    p: [1, 0.3, , , 0.35, 0.4, , , -0.1, , 0.6, -0.7, 0.8, -1, 0.7, 0.5, , , 0.2, -0.2, , , , 0.5], // shot
    g: [1, , 0.06, , 0.5, 0.45, , 0.2, , , , , , , , 0.5, , , 1, , , , , 0.5], // gol
    v: [1, , 0.4, , 0.45, 0.25, , 0.13, , Math.random() * 3, Math.random() * 3, , , , , , , , 1, , , , , 0.3], // vehicle change
    m: [1, , 0.2 * time, , 0.1, 0.6, , , , , , , , , , , , , 1, , , 0.1, , 0.5], // start / end match
    j: [0, , 0.27, , time / 20, 0.3 + Math.random() * 0.2, , 0.12, , , , , , 0.025, , , , , 0.83, , , , , 0.5], // jump
  }[sound]);
  a.play();
};

const speak = (txt) => {
  if (window.SpeechSynthesisUtterance && window.speechSynthesis) {
    const s = new SpeechSynthesisUtterance(txt);
    s.pitch = 0.7;
    s.rate = 0.85;
    speechSynthesis.speak(s);
  }
};

const showPopup = (text, contents, cancelable) => {
  return new Promise((resolve) => {
    popup.innerHTML = `<form>
      <p>${text}</p><br>${contents}<br><button>OK</button>${cancelable ? "<button type=\"button\">Cancel</button>" : ""}
    </form>`;
    popup.classList.remove("h");
    const cancelBtn = $(".popup button:nth-of-type(2n)");
    if (cancelBtn) {
      $(".popup button:nth-of-type(2n)").addEventListener("click", (e) => {
        e.preventDefault();
        popup.innerHTML = "";
        resolve(null);
        popup.close();
      });
    }
    const formEl = $(".popup form");
    if (formEl) {
      $(".popup form").addEventListener("submit", (e) => {
        e.preventDefault();
        popup.innerHTML = "";
        resolve(new FormData(e.target));
        popup.close();

      });
    }
    popup.showModal();
    const firstInput = $(".popup input, .popup select");
    if (firstInput) {
      firstInput.focus();
    }
  });
};

$(".fs").addEventListener("click", () => {
  const d = document.documentElement;
  const f = d.requestFullscreen || d.mozRequestFullScreen || d.webkitRequestFullScreen;
  f.apply(d);
});

$(".ct").addEventListener("click", () => {
  showPopup("Controls", controlsPupupText);
});

$(".cr").addEventListener("click", () => {
  showPopup("Create room",
    `<label>
      Room name
      <input maxlength="14" pattern="[A-Za-z0-9]*" title="only letters and numbers" required autocomplete="off" name="r"></input>
    </label>
    <label>
      # players
      <select name="n">${[20, 18, 16, 14, 12, 10, 8, 6, 4, 2].map(n => `<option value="${n}">${n / 2} vs ${n / 2}</option>`)}</select>
    </label>`,
    true
  ).then((form) => {
    if (form) {
      join(form.get("r"), form.get("n"));
    }
  });
});

$(".jr").addEventListener("click", () => {
  if (socket) {
    socket.emit("roomlist");
  }
});

login.addEventListener("submit", (e) => {
  e.preventDefault();
  $("section").animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(9)" }], 777);
  setTimeout(() => $("section").remove(), 500);
  localStorage.setItem("name", login.querySelector("input").value);
  join();
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const i = $(".c input");
  if (i.value) {
    socket.emit("msg", { text: i.value });
    i.value = "";
  }
  chat.querySelector("input").blur();
});

window.addEventListener("keydown", (e) => {
  if (e.target.tagName == "INPUT" || e.target.tagName == "SELECT") {
    return;
  }

  if (socket && state && !state.m._.sleeping) {
    if (e.code.startsWith("Arrow")) {
      const dir = e.code.at(5).toLowerCase();
      const lockDirection = !e.ctrlKey && !e.metaKey;
      socket.emit("move", { dir, lock: lockDirection });
      document.activeElement.blur();
    }
    if (e.code == "Space" && state.p[socket.id].energy == 100 && !state.p[socket.id].powerL) {
      socket.emit("shot");
      play("p");
    }
    if (e.code == "Space" && state.p[socket.id].powerL) {
      socket.emit("jump");
    }
    if (e.code == "KeyT") {
      socket.emit("switch");
    }
  }
  if (e.code == "Enter" && e.target.tagName != "BUTTON") {
    setTimeout(() => {
      chat.querySelector("input").focus();
    }, 10);
  }
});

const cid = localStorage.getItem("cid") || Math.ceil(Math.random() * 10e15);
localStorage.setItem("cid", cid);
login.querySelector("input").value = localStorage.getItem("name");
