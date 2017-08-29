(() => {
  let TIME = 5 * 60 * 10;
  let colors = ['#e03636', '#17ae09', '#ff0', '#ff3ba5', '#0ff'];
  let names = ['Omicronians', 'Brain Slugs', 'Amphibiosans', 'Nibblonians', 'Blobs', 'Robots', 'Humans'];
  let DH = [L, R];
  let DV = [U, D];
  let rand = (n) => {
    return Math.ceil(Math.random() * n);
  };
  let isValidPos = (pos) => {
    return pos && pos.px >= 0 && pos.py >= 0 && pos.px <= 99 && pos.py <= 99;
  };
  let pick = (arr, exclude) => {
    let a = arr.filter((e) => e != exclude);
    return a[rand(a.length) - 1];
  };
  let _id = 0;

  class Match {

    constructor(cfg) {
      let ca = pick(colors);
      let cb = pick(colors, ca);
      let na = pick(names);
      let nb = pick(names, na);
      this.ss = {}; // sockets
      this.pc = {}; // position cache
      this.ps = {}; // previous state
      this.s = { // state
        m: { // match
          _: {
            id: ++_id,
            started: false,
            ended: false,
            sleeping: false,
            time: TIME,
            name: cfg.name,
            maxp: cfg.maxp,
            minp: cfg.minp
          }
        },
        p: {}, // players
        w: {}, // watchers
        ba: { // ball
          _: {id: "ba", px: 48 + rand(2), py: 48 + rand(2)}
        },
        t: { // teams
          a: {id: "tA", name: na, color: ca, score: 0},
          b: {id: "tB", name: nb, color: cb, score: 0}
        },
        bl: {} // blocks
      };
      this.lt = null; // last touch
      this.ap = null; // assist pass
      this.lgt = TIME; // last goal time
      this.st = { // stats
        goal: {},
        assist: {},
        pass: {},
        recover: {},
        loss: {},
        og: {},
        touch: {},
        vote: {}
      };

      for(let x = 20; x < 80; x++) {
        [30, 69].forEach((y) => {
          let id = 'b'+ x + '_' + y;
          this.s.bl[id] = {id, px: x, py: y, x};
        });
      }

      this.interval = setInterval(() => {
        let ballMoved = false;
        if(!this.s.m._.sleeping && !this.s.m._.ended) {
          if(this.s.m._.started) {
            if(this.s.m._.time > 0) {
              this.s.m._.time--;
            }
            if(!this.cg()) {
              for(let id in this.s.p) {
                let p = this.s.p[id];
                p.u(this);
                if(!ballMoved && this.ub(p.px, p.py, p.dir, p.power)) {
                  let prevTouch = this.lt;
                  this.lt = p.cid;
                  if(prevTouch && prevTouch != this.lt) {
                    let prev = this.s.p[this.cti(prevTouch)];
                    if(prev) {
                      let prevTeam = prev.team;
                      let currentTeam = this.s.p[this.cti(this.lt)].team;
                      if(prevTeam != currentTeam) {
                        this.inc('recover');
                        this.inc('loss', prevTouch);
                        this.ap = null;
                      } else {
                        this.inc('pass', prevTouch);
                        this.ap = prevTouch;
                      }
                    }
                  }
                  this.inc('touch');
                  p.back(this);
                  p.stop(1);
                  p.rp();
                  ballMoved = true;
                }
              }
              if(this.lgt - this.s.m._.time == 250) {
                for(let b in this.s.bl) {
                  if(this.s.bl[b].px >= 47 && this.s.bl[b].px < 53) {
                    this.s.bl[b].px += this.s.bl[b].px >= 50 ? 3 : -3;
                  }
                }
              }
            }
          }
        }
        this.bc();
        if(this.s.m._.ended) {
          clearInterval(this.interval);
        } else if(this.s.m._.time <= 0 || Object.keys(this.s.p).length == 0) {
          this.s.m._.ended = true;
          let winner = this.s.t.a.score > this.s.t.b.score ? 'a' : (this.s.t.a.score < this.s.t.b.score ? 'b' : '' );
          this.bc('stats', {p: this.st, t: !winner ? 'draw' : this.s.t[winner].name + ' won', w: winner});
          console.log(this.s.m._.name, this.st);
        }
      }, 100);

    }

    ub(x, y, d, power) { // update ball
      let ballMoved = false;
      let u = () => {
        let newPos = {px: x, py: y};
        if(x == this.s.ba._.px && y == this.s.ba._.py) {
          let i = 1;
          if(d == U) {
            newPos.py--;
          } else if(d == D) {
            newPos.py++;
          } else if(d == L) {
            newPos.px--;
          } else if(d == R) {
            newPos.px++;
          }
        }
        if(isValidPos(newPos) && this.fp(newPos)) {
          this.s.ba._.px = newPos.px;
          this.s.ba._.py = newPos.py;
          ballMoved = true;
          return 1;
        }
      }
      while(power > 0) {
        if(u()) {
          x = this.s.ba._.px;
          y = this.s.ba._.py;
          power--;
        } else {
          break;
        }
      }
      if(!this.fp(this.s.ba._)) {
        let newPos = {py: this.s.ba._.py, px: this.s.ba._.px};
        if(DH.includes(d)) {
          if(rand(2) == 1) {
            newPos.py++;
          } else {
            newPos.py--;
          }
        } else {
          if(rand(2) == 1) {
            newPos.px++;
          } else {
            newPos.px--;
          }
        }
        if(isValidPos(newPos) && this.fp(newPos)) {
          this.s.ba._.px = newPos.px;
          this.s.ba._.py = newPos.py;
        }
      }
      return ballMoved;
    }

    cg() { // check goal
      if(this.s.ba._.py == 0 || this.s.ba._.py == 99) {
        let tg = this.s.ba._.py == 0 ? 'b' : 'a';
        this.s.t[tg].score++;
        if(this.s.p[this.cti(this.lt)].team == tg) {
          this.inc('goal');
        } else {
          this.inc('og');
        }
        if(this.ap && this.s.p[this.cti(this.ap)].team == tg) {
          this.inc('assist', this.ap);
        }
        this.lgt = this.s.m._.time;
        this.sf(2000).then(() => {
          this.r();
        });
        return true;
      }
    }

    r() { // reset
      this.s.ba._.px = this.s.ba._.py = 50;
      this.lt = null;
      for(let id in this.s.p) {
        this.s.p[id].r();
      }
      for(let b in this.s.bl) {
        this.s.bl[b].px = this.s.bl[b].x;
      }
    }

    sf(time) { // sleep for
      this.s.m._.sleeping = true;
      return new Promise((resolve) => {
        setTimeout(() => {
          this.s.m._.sleeping = false;
          resolve();
        }, time);
      });
    }

    adp(id, name, cid, v) { // add player
      for(let id in this.s.p) {
        if(this.s.p[id].cid == cid) {
          return;
        }
      }
      if(this.f()) {
        this.s.w[id] = {cid, name, id};
        return;
      }
      let team;
      let a = this.cp("a");
      let b = this.cp("b");
      if(a > b) {
        team = "b";
      } else {
        team = "a";
      }
      this.s.p[id] = new Player({id, team, name, cid, v}, this);
      if(!this.s.m._.started && this.cp() >= this.s.m._.minp) {
        if(this.cp() < 2) {
          this.s.m._.started = true;
        } else {
          this.sf(2000).then(() => {
            this.s.m._.started = true;
          });
        }
      }
      this.inc('vote', cid, 0);
    }

    cti(cid) { // client id to socket id
      for(let p in this.s.p) {
        if(this.s.p[p].cid == cid) {
          return p;
        }
      }
    }

    cp(team) { // count players
      let c = 0;
      for(let id in this.s.p) {
        if(!team || this.s.p[id].team == team) {
          c++;
        }
      }
      return c;
    }

    fp(pos) { // is free position
      for(let id in this.s.p) {
        if(this.s.p[id].px == pos.px && this.s.p[id].py == pos.py) {
          return false;
        }
      }
      for(let id in this.s.bl) {
        if(this.s.bl[id].px == pos.px && this.s.bl[id].py == pos.py) {
          return false;
        }
      }
      return true;
    }

    inc(type, who, n = 1) { // increment players stats
      if(!who) {
        who = this.lt;
      }
      let stat = this.st[type];
      if(!stat[who]) {
        stat[who] = {name: this.s.p[this.cti(who)].name, v: type == 'vote' ? 5 : 0, t: this.s.p[this.cti(who)].team};
      }
      stat[who].v += n;
      let vote = {
        goal: 0.35,
        og: -0.3,
        recover: 0.15,
        loss: -0.1,
        touch: 0.005,
        pass: 0.15,
        assist: 0.15
      }[type];
      if(vote) {
        this.inc('vote', who, vote);
      }
    }

    f() { // is full
      return this.cp() >= this.s.m._.maxp;
    }

    bc(event, data) { // broadcast
      let patches;
      for(let id in this.ss) {
        if(event) {
          this.ss[id].emit(event, data);
        } else {
          if(!this.ss[id]._firstSend) {
            this.ss[id].emit("update", this.s);
            this.ss[id]._firstSend = true;
          } else {
            if(!patches) {
              patches = [];
              for(let section in this.s) {
                for(let sprite in this.s[section]) {
                  for(let attr in this.s[section][sprite]) {
                    if(attr[0] == '_') {
                      continue;
                    }
                    let p = this.ps;
                    let v = this.s[section][sprite][attr];
                    if(!p[section] || !p[section][sprite] || p[section][sprite][attr] == undefined || p[section][sprite][attr] != v) {
                      patches.push({k: `${section}.${sprite}.${attr}`, v});
                    }
                  }
                }
              }
            }
            this.ss[id].emit("update", {patches});
          }
        }
      }
      if(!event) {
        this.ps = JSON.parse(JSON.stringify(this.s));
      }
    }

  }

  class Player {

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
      this._ld; // lock dir
      this.r();
      if(match.pc[this.cid]) {
        this.px = match.pc[this.cid].px;
        this.py = match.pc[this.cid].py;
      } else {
        match.pc[this.cid] = {px: this.px, py: this.py};
      }
    }

    u(match) { // update
      if(this.stopped > 0) {
        this.stopped--;
      }
      if(this._dirs.length) {
        this.dir = this._dirs.splice(0, 1)[0];
      } else if(!this._ld) {
        this.dir = '';
      }
      match.pc[this.cid] = {px: this.px, py: this.py};
      let newPos = {px: this.px, py: this.py};
      if(!this.stopped) {
        if(this.dir == U) {
          newPos.py--;
        } else if(this.dir == D) {
          newPos.py++;
        } else if(this.dir == L) {
          newPos.px--;;
        } else if(this.dir == R) {
          newPos.px++;
        }
      }
      if(isValidPos(newPos) && match.fp(newPos)) {
        this.px = newPos.px;
        this.py = newPos.py;
      }
      if(this.power == this.h() && this.energy < 100) {
        this.energy += V[this.v].rec / 4;
      }
      if(this.energy > 100) {
        this.energy = 100;
      }
      if(this.energy < 100) {
        this.info = 'LOST ENERGY';
      } else {
        this.info = '';
      }
    }

    go(dir, lock) {
      let d = this.dir;
      if(this._dirs.length) {
        d = this._dirs[0];
      }
      this._ld = lock;
      /*if((DH.includes(d) && DH.includes(dir)) || (DV.includes(d) && DV.includes(dir))) {
        return;
      }*/
      if(d == dir) {
        return;
      }
      this._dirs.push(dir);
    }

    shot() {
      if(this.energy == 100) {
        this.power = V[this.v].shot * 4;
        this.powerL = true;
      }
    }

    stop(n) {
      this.stopped += n;
    }

    switch(match) {
      let otherTeam = this.team == 'a' ? 'b' : 'a';
      if(!match.s.m._.started && !match.f() && match.cp(otherTeam) < match.s.m._.maxp / 2) {
        this.team = otherTeam;
        this.py = this.team == 'a' ? 4 : 95;
      }
    }

    r() { // reset
      this.px = rand(98);
      this.py = this.team == 'a' ? 4 : 95;
      this.dir = '';
      this._dirs = [];
      this.energy = 100;
      this.power = this.h();
      this.info = '';
      this.powerL = false;
      this.stopped = 0;
      this._ld = false;
    }

    rp() { // reset power
      if(this.power != this.h()) {
        this.power = this.h();
        this.energy = 0;
        this.powerL = false;
      }
    }

    back(match) {
      let pc = match.pc[this.cid];
      if(pc) {
        this.px = pc.px;
        this.py = pc.py;
      }
    }

    h() { //get hit
      return V[this.v].hit / 2;
    }

  }

  let cleanString = str => str.replace(/[<>]/gi, '');

  let rooms = {};

  setInterval(() => {
    for(let r in rooms) {
      if(rooms[r].s.m._.ended) {
        delete rooms[r];
      }
    }
  }, 10 * 1000);

  module.exports = (socket) => {

    let cid = socket.handshake.query.cid;
    let name = cleanString(socket.handshake.query.name.substr(0, 12));
    let roomName = cleanString((socket.handshake.query.room || 'training').substr(0, 14));
    let players = parseInt(socket.handshake.query.playersNr || 0);
    let vehicle = socket.handshake.query.v;
    let isTraining = roomName == 'training';

    if(!rooms[roomName] || rooms[roomName].s.m._.ended || (rooms[roomName].f() && isTraining)) {
      if(players == 0 && rooms[roomName]) {
        players = rooms[roomName].s.m._.maxp;
      }
      if(!players) {
        players = 10;
      }
      rooms[roomName] = new Match({name: roomName, maxp: players, minp: isTraining ? 1 : players});
      console.log("new match", rooms[roomName].s.m._.id, roomName);
    }

    socket.m = rooms[roomName];

    socket.on("disconnect", () => {
      if(socket.m.s.p[socket.id]) {
        socket.m.s.p[socket.id].deleted = true;
        socket.m.bc();
        delete socket.m.s.p[socket.id];
      } else if(socket.m.s.w[socket.id]) {
        delete socket.m.s.w[socket.id];
      }
      delete socket.m.ss[socket.id];
    });

    socket.on("move", (data) => {
      if(socket.m.s.m._.started) {
        if(socket.m.s.p[socket.id]) {
          socket.m.s.p[socket.id].go(data.dir, data.lock);
        }
      }
    });

    socket.on("shot", (data) => {
      if(socket.m.s.p[socket.id]) {
        socket.m.s.p[socket.id].shot();
      }
    });

    socket.on("switch", (data) => {
      if(socket.m.s.p[socket.id]) {
        socket.m.s.p[socket.id].switch(socket.m);
      }
    });

    socket.on("roomlist", () => {
      let list = [{room: 'training'}];
      for(let r in rooms) {
        let p = rooms[r].cp();
        if(p > 0 && r != 'training') {
          list.push({room: r, p, m: rooms[r].s.m._.maxp});
        }
      }
      socket.emit("rooms", list);
    });

    socket.on("msg", (data) => {
      if(socket.m.s.p[socket.id]) {
        data.user = socket.m.s.p[socket.id].name;
        data.team = socket.m.s.p[socket.id].team;
      } else if(socket.m.s.w[socket.id]) {
        data.user = socket.m.s.w[socket.id].name;
      } else {
        return;
      }
      console.log(socket.m.s.m._.name, '-', data.user, ':' , data.text);
      data.text = cleanString(data.text);
      socket.m.bc("msg", data);
    });

    console.log(name, "join", roomName);
    socket.m.ss[socket.id] = socket;
    socket.m.adp(socket.id, name, cid, vehicle);
    socket.m.bc();

  };
})();
