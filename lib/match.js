import { U, D, L, R, MATCH_TIME, TEAM_COLORS, TEAM_NAMES } from "./constants.js";
import { rand, pick, isValidPos } from "./utils.js";
import { Player } from "./player.js";

let _id = 0;

export class Match {
  constructor(cfg = {}) {
    const matchTime = cfg.isTraining ? Number.MAX_SAFE_INTEGER : MATCH_TIME;
    const colorTeamA = pick(TEAM_COLORS);
    const colorTeamB = pick(TEAM_COLORS, colorTeamA);
    const nameTeamA = pick(TEAM_NAMES);
    const nameTeamB = pick(TEAM_NAMES, nameTeamA);
    this.sockets = {};
    this.positionCache = {};
    this.previousState = {};
    this.s = { // state
      m: { // match
        _: {
          id: ++_id,
          started: false,
          ended: false,
          sleeping: false,
          time: matchTime,
          name: cfg.name || `Match ${_id}`,
          maxp: cfg.maxp || 20,
          minp: cfg.minp || 0
        }
      },
      p: {}, // players
      w: {}, // watchers
      ba: { // ball
        _: { id: "ba", px: 48 + rand(2), py: 48 + rand(2) }
      },
      t: { // teams
        a: { id: "tA", name: nameTeamA, color: colorTeamA, score: 0 },
        b: { id: "tB", name: nameTeamB, color: colorTeamB, score: 0 }
      },
      bl: {} // blocks
    };
    this.lastTouch = null;
    this.assistPass = null;
    this.lastGoalTime = matchTime;
    this.stats = {
      goal: {},
      assist: {},
      pass: {},
      recover: {},
      loss: {},
      og: {},
      touch: {},
      vote: {}
    };

    for (let x = 30; x < 70; x++) {
      [30, 69].forEach((y) => {
        const id = "b" + x + "_" + y;
        this.s.bl[id] = { id, px: x, py: y, x, y };
      });
    }

    this.interval = setInterval(() => {
      let ballMoved = false;
      if (!this.s.m._.sleeping && !this.s.m._.ended) {
        if (this.s.m._.started) {
          if (this.s.m._.time > 0) {
            this.s.m._.time--;
          }
          if (!this.checkGoal()) {
            for (const id in this.s.p) {
              const p = this.s.p[id];
              p.update(this);
              if (!ballMoved && this.updateBall(p.px, p.py, p.dir, p.power)) {
                const prevTouch = this.lastTouch;
                this.lastTouch = p.cid;
                if (prevTouch && prevTouch != this.lastTouch) {
                  const prev = this.s.p[this.clientIdToSocketId(prevTouch)];
                  if (prev) {
                    const prevTeam = prev.team;
                    const currentTeam = this.s.p[this.clientIdToSocketId(this.lastTouch)].team;
                    if (prevTeam != currentTeam) {
                      this.incrementStat("recover");
                      this.incrementStat("loss", prevTouch);
                      this.assistPass = null;
                    } else {
                      this.incrementStat("pass", prevTouch);
                      this.assistPass = prevTouch;
                    }
                  }
                }
                this.incrementStat("touch");
                p.back(this);
                p.resetPower();
                ballMoved = true;
              }
            }
            if (!this.isFreePosition(this.s.ba._)) {
              this.moveBallInAFreePos();
            }
            if (this.lastGoalTime - this.s.m._.time == 150) {
              const opening = 6;
              for (const b in this.s.bl) {
                if (this.s.bl[b].px >= 50 - opening && this.s.bl[b].px < 50 + opening) {
                  this.s.bl[b].px += this.s.bl[b].px >= 50 ? opening : -opening;
                }
              }
            }
          }
        }
      }
      this.broadcast();
      if (this.s.m._.ended) {
        clearInterval(this.interval);
      } else if (this.s.m._.time <= 0 || Object.keys(this.s.p).length == 0) {
        this.s.m._.ended = true;
        const winner = this.s.t.a.score > this.s.t.b.score ? "a" : (this.s.t.a.score < this.s.t.b.score ? "b" : "");
        this.broadcast("stats", { p: this.stats, t: !winner ? "draw" : this.s.t[winner].name + " won", w: winner });
        console.log(this.s.m._.name, this.stats);
      }
    }, 100);

  }

  updateBall(x, y, d, power) {
    let ballMoved = false;
    const updateBallPos = () => {
      const newPos = { px: x, py: y };
      if (x == this.s.ba._.px && y == this.s.ba._.py) {
        if (d == U) {
          newPos.py--;
        } else if (d == D) {
          newPos.py++;
        } else if (d == L) {
          newPos.px--;
        } else if (d == R) {
          newPos.px++;
        }
      }
      if (isValidPos(newPos) && this.isFreePosition(newPos)) {
        this.s.ba._.px = newPos.px;
        this.s.ba._.py = newPos.py;
        ballMoved = true;
        return 1;
      }
    };
    while (power > 0) {
      if (updateBallPos()) {
        x = this.s.ba._.px;
        y = this.s.ba._.py;
        power--;
      } else {
        break;
      }
    }
    return ballMoved;
  }

  moveBallInAFreePos() {
    const freePositions = [];

    for (let y = this.s.ba._.py - 1; y <= this.s.ba._.py + 1; y++) {
      for (let x = this.s.ba._.px - 1; x <= this.s.ba._.px + 1; x++) {
        const pos = { py: y, px: x };
        if (isValidPos(pos) && this.isFreePosition(pos)) {
          freePositions.push(pos);
        }
      }
    }

    if (freePositions.length > 0) {
      const newPos = pick(freePositions);
      this.s.ba._.px = newPos.px;
      this.s.ba._.py = newPos.py;
    }
  }

  checkGoal() {
    if (this.s.ba._.py == 0 || this.s.ba._.py == 99) {
      const tg = this.s.ba._.py == 0 ? "b" : "a";
      this.s.t[tg].score++;
      if (this.s.p[this.clientIdToSocketId(this.lastTouch)].team == tg) {
        this.incrementStat("goal");
        this.broadcast("speak", `goal! ${this.s.p[this.clientIdToSocketId(this.lastTouch)].name} goal!`);
      } else {
        this.incrementStat("og");
        this.broadcast("speak", `it's an own goal by ${this.s.p[this.clientIdToSocketId(this.lastTouch)].name}!`);
      }
      if (this.assistPass && this.s.p[this.clientIdToSocketId(this.assistPass)].team == tg) {
        this.incrementStat("assist", this.assistPass);
        this.broadcast("speak", `${this.s.p[this.clientIdToSocketId(this.assistPass)].name} served the assist.`);
      }
      this.lastGoalTime = this.s.m._.time;
      this.sleepFor(2000).then(() => {
        this.reset();
        this.sleepFor(50);
      });
      return true;
    }
  }

  reset() {
    this.s.ba._.px = 48 + rand(2);
    this.s.ba._.py = 48 + rand(2);
    this.lastTouch = null;
    this.assistPass = null;
    for (const id in this.s.p) {
      this.s.p[id].reset();
    }
    for (const b in this.s.bl) {
      this.s.bl[b].px = this.s.bl[b].x;
      this.s.bl[b].py = this.s.bl[b].y;
    }
  }

  sleepFor(time) {
    this.s.m._.sleeping = true;
    return new Promise((resolve) => {
      setTimeout(() => {
        this.s.m._.sleeping = false;
        resolve();
      }, time);
    });
  }

  addPlayer(id, name, cid, v) {
    for (const id in this.s.p) {
      if (this.s.p[id].cid == cid) {
        return;
      }
    }
    if (this.isFull()) {
      this.s.w[id] = { cid, name, id };
      return;
    }
    let team;
    const a = this.countPlayers("a");
    const b = this.countPlayers("b");
    if (a > b) {
      team = "b";
    } else {
      team = "a";
    }
    this.s.p[id] = new Player({ id, team, name, cid, v }, this);
    if (!this.s.m._.started && this.countPlayers() >= this.s.m._.minp) {
      if (this.countPlayers() < 2) {
        this.s.m._.started = true;
      } else {
        this.sleepFor(2000).then(() => {
          this.s.m._.started = true;
        });
      }
    }
    this.incrementStat("vote", cid, 0);
  }

  clientIdToSocketId(cid) {
    for (const p in this.s.p) {
      if (this.s.p[p].cid == cid) {
        return p;
      }
    }
  }

  countPlayers(team) {
    let c = 0;
    for (const id in this.s.p) {
      if (!team || this.s.p[id].team == team) {
        c++;
      }
    }
    return c;
  }

  isFreePosition(pos) {
    for (const id in this.s.p) {
      if (this.s.p[id].px == pos.px && this.s.p[id].py == pos.py) {
        return false;
      }
    }
    for (const id in this.s.bl) {
      if (this.s.bl[id].px == pos.px && this.s.bl[id].py == pos.py) {
        return false;
      }
    }
    return true;
  }

  isBallPosition(pos) {
    return this.s.ba._.px == pos.px && this.s.ba._.py == pos.py;
  }

  incrementStat(type, who, n = 1) {
    if (!who) {
      who = this.lastTouch;
    }
    const stat = this.stats[type];
    if (!stat[who]) {
      stat[who] = {
        name: this.s.p[this.clientIdToSocketId(who)].name,
        v: type == "vote" ? 5 : 0,
        t: this.s.p[this.clientIdToSocketId(who)].team
      };
    }
    stat[who].v += n;
    const vote = {
      goal: 0.35,
      og: -0.3,
      recover: 0.15,
      loss: -0.1,
      touch: 0.005,
      pass: 0.15,
      assist: 0.15
    }[type];
    if (vote) {
      this.incrementStat("vote", who, vote);
    }
  }

  isFull() {
    return this.countPlayers() >= this.s.m._.maxp;
  }

  broadcast(event, data) {
    let patches;
    for (const id in this.sockets) {
      if (event) {
        this.sockets[id].emit(event, data);
      } else {
        if (!this.sockets[id]._firstSend) {
          this.sockets[id].emit("update", this.s);
          this.sockets[id]._firstSend = true;
        } else {
          if (!patches) {
            patches = [];
            for (const section in this.s) {
              for (const sprite in this.s[section]) {
                for (const attr in this.s[section][sprite]) {
                  if (attr[0] == "_") {
                    continue;
                  }
                  const p = this.previousState;
                  const v = this.s[section][sprite][attr];
                  if (!p[section] || !p[section][sprite] || p[section][sprite][attr] == undefined || p[section][sprite][attr] != v) {
                    patches.push({ k: `${section}.${sprite}.${attr}`, v });
                  }
                }
              }
            }
          }
          this.sockets[id].emit("update", { patches });
        }
      }
    }
    if (!event) {
      this.previousState = structuredClone(this.s);
    }
  }
}
