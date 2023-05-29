import { U, D, L, R } from "./constants.js";
import { V } from "../shared/shared.js";
import { rand, isValidPos } from "./utils.js";

export class Player {
  constructor(cfg, match) {
    this.id = cfg.id;
    this.cid = cfg.cid;
    this.name = cfg.name;
    this.v = cfg.v;
    this.team = cfg.team;
    this.px;
    this.py;
    this.power;
    this.powerL;
    this.dir;
    this._dirs = [];
    this.energy;
    this.info = '';
    this.stopped = 0;
    this._lockDir;
    this.reset();
    if (match.positionCache[this.cid]) {
      this.px = match.positionCache[this.cid].px;
      this.py = match.positionCache[this.cid].py;
    } else {
      match.positionCache[this.cid] = { px: this.px, py: this.py };
    }
  }

  update(match) {
    if (this.stopped > 0) {
      this.stopped--;
    }
    if (this._dirs.length) {
      this.dir = this._dirs.splice(0, 1)[0];
    } else if (!this._lockDir) {
      this.dir = '';
    }
    match.positionCache[this.cid] = { px: this.px, py: this.py };
    const newPos = { px: this.px, py: this.py };
    if (!this.stopped) {
      if (this.dir == U) {
        newPos.py--;
      } else if (this.dir == D) {
        newPos.py++;
      } else if (this.dir == L) {
        newPos.px--;;
      } else if (this.dir == R) {
        newPos.px++;
      }
    }
    if (isValidPos(newPos) && match.isFreePosition(newPos)) {
      this.px = newPos.px;
      this.py = newPos.py;
    }
    if (this.power == this.getHit() && this.energy < 100) {
      this.energy += V[this.v].rec / 4;
    }
    if (this.energy > 100) {
      this.energy = 100;
    }
    if (this.energy < 100) {
      this.info = 'SHOT RECHARGING';
    } else {
      this.info = '';
    }
  }

  go(dir, lock) {
    let d = this.dir;
    if (this._dirs.length) {
      d = this._dirs[0];
    }
    this._lockDir = lock;
    if (d == dir) {
      return;
    }
    this._dirs.push(dir);
  }

  shot() {
    if (this.energy == 100) {
      this.power = V[this.v].shot * 4;
      this.powerL = true;
    }
  }

  stop(n) {
    this.stopped += n;
  }

  switchTeam(match) {
    const otherTeam = this.team == 'a' ? 'b' : 'a';
    if (!match.s.m._.started && !match.isFull() && match.countPlayers(otherTeam) < match.s.m._.maxp / 2) {
      this.team = otherTeam;
      this.py = this.team == 'a' ? 4 : 95;
    }
  }

  reset() {
    this.px = rand(98);
    this.py = this.team == 'a' ? 4 : 95;
    this.dir = '';
    this._dirs = [];
    this.energy = 100;
    this.power = this.getHit();
    this.info = '';
    this.powerL = false;
    this.stopped = 0;
    this._lockDir = false;
  }

  resetPower() {
    if (this.power != this.getHit()) {
      this.power = this.getHit();
      this.energy = 0;
      this.powerL = false;
    }
  }

  back(match) {
    const prevPos = match.positionCache[this.cid];
    if (prevPos) {
      this.px = prevPos.px;
      this.py = prevPos.py;
    }
  }

  getHit() {
    return V[this.v].hit / 2;
  }
}