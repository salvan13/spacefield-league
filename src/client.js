(() => {
  let socket, state;
  let mute, firstLogin = !localStorage.getItem('cid');
  let controlsPupupText = 'arrows / wasd / zqsd = move<br>Space = shot<br>ctrl + move = precise move<br>Enter = chat<br>M = toggle music';
  let $ = (s) => document.querySelector(s);
  let $$ = (s) => document.querySelectorAll(s);

  let main = $('main'),
    info = $('.info'),
    popup = $('.popup'),
    actions = $('.ac'),
    chat = $('.c'),
    msgs = $('.c ul'),
    chatForm = $('.c form'),
    login = $('.l');

  let join = (roomName = '', playersNr) => {

    if(socket) {
      socket.disconnect();
    }

    let firstLoop = true;
    let name = localStorage.getItem('name');
    msgs.innerHTML = info.innerHTML = '';
    actions.classList.add('h');
    chat.classList.add('h');

    let connect = () => {

      document.body.classList.add('loading');

      socket = io({query: `name=${encodeURIComponent(name)}&cid=${cid}&room=${roomName}&v=${localStorage.getItem('v') || 0}` + (playersNr ? `&playersNr=${playersNr}` : '')});

      socket.on("connect", () => {
        document.body.classList.remove('loading');
        main.classList.add('ready');
        actions.classList.remove('h');
        chat.classList.remove('h');
        main.innerHTML = '';
        play('s');
      });

      socket.on("disconnect", (e) => {
        main.classList.remove('ready');
        main.innerHTML = '';
      });

      socket.on("error", (e) => {
        main.classList.remove('ready');
        main.innerHTML = '';
      });

      socket.on("rooms", (rooms) => {
        showPopup('Join in a room', `<label>Select a room<select name="r" required>${rooms.map((r) => `<option value="${r.room}|!!|${r.m}">${r.room} ${r.p >= 0 ? r.p : ''}${r.m >= 0 ? ('/' + r.m) : ''}</option>`).join('')}</select></label>`, true).then((form) => {
          let r = form.get('r').split('|!!|');
          join(r[0], r[1]);
        });
      });

      socket.on("msg", (data) => {
        let li = document.createElement('li');
        li.innerHTML = `<span class="${data.team}">${data.user}:</span> ` + data.text;
        msgs.appendChild(li);
        li.animate([{background: '#000'}, {background: 'transparent'}], 3000);
      });

      socket.on("pong", (ms) => {
        $('.ping').innerHTML = `ping: ${ms}`;
      });

      socket.on("stats", (stats) => {
        showPopup(`<h3 class="${stats.w}">${stats.t}</h3>`, `<table><thead><tr><th>Player</th>${Object.keys(stats.p).map(e => `<th>${e}</th>`).join('')}<tr><thead><tbody></tbody></table>`);
        let rows = {};
        for(let stat in stats.p) {
          for(let player in stats.p[stat]) {
            if(!rows[player]) {
              let tr = document.createElement('tr');
              tr.classList.add(stats.p[stat][player].t);
              tr.innerHTML = `<tr><td>${stats.p[stat][player].name}</td>${Object.keys(stats.p).map(e => `<td class='${e}'>0</td>`).join('')}</tr>`;
              rows[player] = {el: tr, vote: stats.p.vote[player].v};
            }
            let v = stats.p[stat][player].v;
            rows[player].el.querySelector('.' + stat).innerHTML = stat == 'vote' ? v.toFixed(2) : v;
          }
        }
        let list = [];
        for(let player in rows) {
          list.push(rows[player]);
        }
        list.sort((a, b) => b.vote - a.vote);
        list.forEach((e) => $('.popup tbody').appendChild(e.el));
      });

      socket.on("update", (upd) => {
        requestAnimationFrame(() => {
          if(!socket || !socket.connected) {
            return;
          }
          if(upd.patches) {
            upd.patches.forEach((u) => {
              let d = u.k.split('.');
              if(!state[d[0]][d[1]]) {
                state[d[0]][d[1]] = {};
              }
              state[d[0]][d[1]][d[2]] = u.v;
            });
          } else {
            state = upd;
          }
          updateState(state);
          for(let section in state) {
            for(let sprite in state[section]) {
              let el = $(`#id_${state[section][sprite].id}`);
              if(!el) {
                el = document.createElement('div');
                el.classList.add(section);
                if(section == 'p') {
                  if(cid == state[section][sprite].cid) {
                    el.classList.add('me');
                    let s = document.createElement('div');
                    s.classList.add('sh'); // shadow
                    el.appendChild(s);
                    blink(el, 20, 4000);
                  }
                  if(!firstLoop) {
                    speak(`${state[section][sprite].name} is now in the room`);
                  }
                }
                el.setAttribute('id', `id_${state[section][sprite].id}`);
                main.appendChild(el);
                updateInfo(state);
              }
              if(state[section][sprite].deleted) {
                el.remove();
                if(section == 'p') {
                  updateInfo(state, true);
                  speak(`${state[section][sprite].name} left`);
                  delete state[section][sprite];
                }
              }
              for(let attr in state[section][sprite]) {
                let newVal = state[section][sprite][attr];
                let oldVal = el.dataset[attr];
                let isNew = oldVal == undefined;
                let isChanded = !isNew && ((oldVal + "") != (newVal + ""));
                on(el, state, section, sprite, attr, newVal, oldVal, isNew, isChanded);
              }
            }
          }
          firstLoop = false;
        });
      });

    };

    let on = (el, state, section, sprite, attr, newVal, oldVal, isNew, isChanded) => {
      if(isNew || isChanded) {
        el.style.setProperty(`--${attr}`, newVal);
        el.dataset[attr] = newVal;
        if(section == 't') {
          if(attr == 'color') {
            document.body.style.setProperty(`--color-${state[section][sprite].id}`, newVal);
          }
        }
        if(section == 'p') {
          if(attr == 'dir' && newVal) {
            el.style.setProperty('--player-rotate', ({u: -90, d: 90, l: 180}[newVal] || 0) + 'deg');
          }
        }
        if(section == 'm') {
          if(attr == 'name') {
            updateInfo(state);
          }
          if(attr == 'started' || attr == 'ended') {
            main.classList.toggle(attr, newVal);
            if(isChanded) {
              play('m');
              setTimeout(() => play('m', 2), 300);
              setTimeout(() => play('m', 3), 800);
            }
          }
        }
      }
      if(isChanded) {
        if(section == 't') {
          if(attr == 'score') {
            blink(el, 20, 4000);
            boom(main);
            play('g');
          }
        }
        if(section == 'ba') {
          let diff = Math.abs(parseInt(newVal) - parseInt(oldVal));
          el.animate([{transform: 'scale(1)'}, {transform: `scale(${diff <= 4 ? 1.3 : 2})`}, {transform: 'scale(1)'}], 100);
          play('b' + (diff <= 4 ? '' : 'l'));
        }
        if(section == 'p') {
          if(attr == 'px' || attr == 'py') {
            if(state[section][sprite].cid == cid) {
              let t = document.createElement('div');
              t.classList.add('track');
              t.classList.add(state[section][sprite].team);
              t.style.setProperty(`--px`, state[section][sprite].px);
              t.style.setProperty(`--py`, state[section][sprite].py);
              main.appendChild(t);
              t.animate([{opacity: 0.5, transform: 'scale(1)'}, {opacity: 0.5, transform: 'scale(0.5)'}, {opacity: 0, transform: 'scale(0.1)'}], {delay: 200, duration: 1500}).onfinish = () => t.remove();
            }
          }
        }
      }
    };

    let updateInfo = (state, del) => {
      info.innerHTML = 'room: ' + state.m._.name + ` <span>${Object.keys(state.p).length - (del ? 1 : 0)}/${state.m._.maxp}</span>`;
    };

    let updateState = (s) => {
      if(typeof s.m._.time == 'number') {
        let t = '' + s.m._.time;
        let arr = t.split('');
        arr.splice(t.length - 1, 0, '.');
        s.m._.time = arr.join('');
        if(s.m._.time.length == 2) {
          s.m._.time = '0' + s.m._.time;
        }
      }
    };

    if(firstLogin) {
      showPopup('Welcome', 'You are about to join a training room<br>Your goal is to put the ball in the side with your color<br>Train and then play in custom rooms').then(() => {
        firstLogin = false;
        showPopup('Controls', controlsPupupText).then(connect);
      });
    } else {
      showPopup('vehicle selection', `<input type="hidden" name="v"></input><div class="v"><div class="p me" data-info=""><div class="sh"></div></div><div class="i"><p data-p="rec">energy recovery</p><p data-p="shot">shot power</p><p data-p="hit">hit power</p></div><div class="s">${V.map((v, i) => `<a href='#${i}' data-i=${i}>${v.n}</a>`).join('')}</div></div>`).then((form) => {
        let vehicle = form.get('v');
        localStorage.setItem('v', vehicle);
        connect();
      });
      $$('.v a').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          let index = e.target.dataset.i;
          let p = $('.v .p');
          if(p.dataset.v == e.target.dataset.i) {
            return;
          }
          play('v');
          $$('.sel').forEach((sel) => sel.classList.remove('sel'));
          e.target.classList.add('sel');
          $('[name="v"]').value = p.dataset.v = index;
          p.dataset.name = V[index].n;
          $$('.v p').forEach((el, i) => {
            el.style.setProperty(`--val`, V[index][el.dataset.p]);
          });
          for(let i = 0; i < 7; i++) {
            setTimeout(() => p.dataset.info = V[index].n.split('').sort(() => 0.5 - Math.random()).join(''), i * 150);
          }
          setTimeout(() => p.dataset.info = '', 1500);
        });
        let vehicle = localStorage.getItem('v') || 0;
        if(vehicle == el.dataset.i) {
          el.click();
        }
      });
    }

  };

  let blink = (el, n = 20, t = 1000) => {
    let anim = [];
    for(let x = 0; x < n; x++) {
      anim.push({opacity: x % 2 ? 0 : 1});
    }
    el.animate(anim, t);
  };

  let boom = (el, n = 20, t = 1000) => {
    let anim = [];
    for(let x = 0; x < n; x++) {
      anim.push({transform: x % 2 ? 'translateX(-4px)' : 'translateX(4px)'});
    }
    el.animate(anim, t);
  };

  let play = (sound, time = 1) => {
    let a = new Audio();
    a.src = jsfxr({
      s: [2,,0.6,,0.4,0.36,,-0.2,-0.6,0.02,-0.7,0.6,-0.4,0.2,0.01,0.4,0.4,-0.4,0.9,-0.3,-0.2,0.2,,0.5], // start
      b: [,,,,0.2,0.1+0.3*Math.random(),,-0.4,,,,,,0.5,,,,,1,,,,,0.5], // ball touch
      bl: [2,,0.05,,0.2,0.7,,-0.4,,,,,,,,,,,1,,,,,0.5], // ball long touch
      p: [1,0.3,,,0.35,0.4,,,-0.1,,0.6,-0.7,0.8,-1,0.7,0.5,,,0.2,-0.2,,,,0.5], // shot
      g: [1,,0.06,,0.5,0.45,,0.2,,,,,,,,0.5,,,1,,,,,0.5], // gol
      v: [1,,0.4,,0.45,0.25,,0.13,,Math.random()*3,Math.random()*3,,,,,,,,1,,,,,0.3], // vehicle change
      m: [1,,0.2 * time,,0.1,0.6,,,,,,,,,,,,,1,,,0.1,,0.5] // start / end match
    }[sound]);
    a.play();
  };

  let speak = (txt) => {
    if(window.SpeechSynthesisUtterance && window.speechSynthesis) {
      let s = new SpeechSynthesisUtterance(txt);
      s.pitch = 0.01;
      s.rate = 0.5;
      speechSynthesis.speak(s);
    }
  };

  let showPopup = (text, contents, cancelable) => {
    return new Promise((resolve) => {
      popup.innerHTML = `<form><p>${text}</p><br>${contents}<br><button>OK</button>${cancelable ? '<button type="button">Cancel</button>' : ''}</form>`;
      popup.classList.remove('h');
      let cancelBtn = $('.popup button:nth-of-type(2n)');
      if(cancelBtn) {
        $('.popup button:nth-of-type(2n)').addEventListener('click', (e) => {
          e.preventDefault();
          popup.innerHTML = '';
          popup.classList.add('h');
        });
      }
      let formEl = $('.popup form');
      if(formEl) {
        $('.popup form').addEventListener('submit', (e) => {
          e.preventDefault();
          popup.innerHTML = '';
          popup.classList.add('h');
          resolve(new FormData(e.target));
        });
      }
      let firstInput = $('.popup input, .popup select');
      if(firstInput) {
        firstInput.focus();
      }
    });
  };

  $('.fs').addEventListener('click', () => {
    let d = document.documentElement;
    let f = d.requestFullscreen || d.mozRequestFullScreen || d.webkitRequestFullScreen;
    f.apply(d);
  });

  $('.ct').addEventListener('click', () => {
    showPopup('Controls', controlsPupupText);
  });

  $('.cr').addEventListener('click', () => {
    showPopup('Create room', `<label>Room name<input maxlength="14" pattern="[A-Za-z0-9]*" title="only letters and numbers" required autocomplete="off" name="r"></input></label> <label># players <select name="n">${[10,8,6,4,2].map(n => `<option value="${n}">${n/2} vs ${n/2}</option>`)}</select></label>`, true).then((form) => {
      join(form.get('r'), form.get('n'));
    });
  });

  $('.jr').addEventListener('click', () => {
    if(socket) {
      socket.emit('roomlist');
    }
  });

  login.addEventListener('submit', (e) => {
    e.preventDefault();
    $('section').animate([{opacity: 1, transform: 'scale(1)'}, {opacity: 0, transform: 'scale(9)'}], 777);
    setTimeout(() => $('section').remove(), 500);
    localStorage.setItem('name', login.querySelector('input').value);
    join();
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let i = $('.c input');
    if(i.value) {
      socket.emit('msg', {text: i.value});
      i.value = '';
    }
    chat.querySelector('input').blur();
  });

  let dirControls = {
    u: [38, 90, 87],
    r: [39, 68],
    d: [40, 83],
    l: [37, 65, 81]
  };

  window.addEventListener('keydown', (e) => {
    if(e.target.tagName == 'INPUT' || e.target.tagName == 'SELECT') {
      return;
    }
    let k = e.keyCode;
    if(socket && state && !state.m._.sleeping) {
      for(let dir in dirControls) {
        if(dirControls[dir].includes(k)) {
          let lockDirection = !e.ctrlKey && !e.metaKey;
          socket.emit('move', {dir, lock: lockDirection});
          document.activeElement.blur();
        }
      }
      if(k == 32 /* spacebar */ && state.p[socket.id].energy == 100 && !state.p[socket.id].powerL) {
        socket.emit('shot');
        play('p');
      }
      if(k == 84 /* t */) {
        socket.emit('switch');
      }
    }
    if(k == 13 /* enter */ && e.target.tagName != 'BUTTON') {
      setTimeout(() => {
        chat.querySelector('input').focus();
      }, 10);
    }
    if(k == 77 /* m */) {
      mute = !mute;
    }
  });

  let cid = localStorage.getItem('cid') || Math.ceil(Math.random() * 10e15);
  localStorage.setItem('cid', cid);
  login.querySelector('input').value = localStorage.getItem('name');

  // music
  let actx = new AudioContext();
  let anode = actx.createScriptProcessor(0, 0, 1);
  let anr = 0;
  let aseq = [[0,1,,,1,0],[5,1,,,4,0],[1,4,,,5,0],[3,1,,,1,3]];
  let aseqi = 0;
  anode.onaudioprocess = (e) => {
    let data = e.outputBuffer.getChannelData(0);
    for(let i = 0; i < data.length; i++) {
      let t = ++anr / actx.sampleRate * 2.2;
      if(anr % (((7.27275 * actx.sampleRate)|0)*2) == 0) {
        aseqi++;
      }
      data[i] = mute ? 0 : (Math.random()*(((1-t*2%1)**5)+((1-t/2%1)**16)*8)+(t*(t&12|32)*aseq[aseqi%aseq.length][t*2&5]%1))/16;
    }
  };
  anode.connect(actx.destination);

})();
