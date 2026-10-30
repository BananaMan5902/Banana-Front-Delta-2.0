
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WORLD_W = 2200;
const WORLD_H = 1600;

let camera = { x: 0, y: 0 };
let money = 500;
let kills = 0;
let wave = 1;
let selectedBuild = null;
let selected = null;
let buildings = [];
let units = [];
let bullets = [];
let particles = [];
let gameOver = false;
let lastTime = 0;
let aiTimer = 5;
let incomeTimer = 0;
let messageTimer = 0;
let elapsed = 0;

const prices = {
  factory: 150,
  barracks: 200,
  turret: 125,
  bunker: 175,
  wall: 30,
  farm: 100
};

const info = {
  factory: { name: "Factory", hp: 350, income: 8 },
  barracks: { name: "Barracks", hp: 400 },
  turret: { name: "Machine Gun Turret", hp: 250, damage: 12, range: 230 },
  bunker: { name: "Bunker", hp: 650, damage: 18, range: 190 },
  wall: { name: "Wall", hp: 500 },
  farm: { name: "Banana Farm", hp: 250, income: 4 },
  hq: { name: "Headquarters", hp: 1000 }
};

const buildingsData = {
  factory: { color: "#c4a24c", symbol: "🏭" },
  barracks: { color: "#788a9b", symbol: "🏕️" },
  turret: { color: "#555e64", symbol: "🔫" },
  bunker: { color: "#596b4d", symbol: "🛡️" },
  wall: { color: "#89877c", symbol: "🧱" },
  farm: { color: "#8da744", symbol: "🍌" },
  hq: { color: "#d4b82e", symbol: "🏰" }
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resize);
resize();

function makeBuilding(type, x, y, team = "player") {
  const data = info[type];

  return {
    type, x, y,
    team,
    hp: data.hp,
    maxHp: data.hp,
    level: 1,
    cooldown: 0,
    spawnTimer: 0,
    size: type === "wall" ? 40 : 48
  };
}

function makeUnit(x, y, team) {
  return {
    x, y,
    team,
    hp: 100,
    maxHp: 100,
    speed: team === "player" ? 52 : 43,
    damage: 12,
    range: 25,
    cooldown: Math.random(),
    size: 11,
    target: null
  };
}

function resetGame() {
  money = 500;
  kills = 0;
  wave = 1;
  selectedBuild = null;
  selected = null;
  buildings = [];
  units = [];
  bullets = [];
  particles = [];
  gameOver = false;
  elapsed = 0;
  aiTimer = 5;
  incomeTimer = 0;

  buildings.push(makeBuilding("hq", 350, 350));
  buildings.push(makeBuilding("hq", 1850, 1250, "enemy"));

  camera.x = 0;
  camera.y = 0;

  for (let i = 0; i < 3; i++) {
    units.push(makeUnit(410 + i * 25, 410, "player"));
  }

  updateUI();
  say("Welcome to Banana Front! Build your army!");
}

resetGame();

function say(text) {
  document.getElementById("message").textContent = text;
  messageTimer = 4;
}

function chooseBuild(type) {
  if (gameOver) return;

  selected = null;

  if (money < prices[type]) {
    say("Not enough money!");
    return;
  }

  selectedBuild = type;
  say("Place your " + info[type].name + " on the battlefield.");
}

function mouseWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left + camera.x,
    y: e.clientY - rect.top + camera.y
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function blocked(x, y, size) {
  if (x < size || y < size ||
      x > WORLD_W - size || y > WORLD_H - size) return true;

  return buildings.some(b =>
    distance({ x, y }, b) < (size + b.size) * 0.85
  );
}

canvas.addEventListener("click", e => {
  if (gameOver) return;

  const p = mouseWorld(e);

  if (selectedBuild) {
    const type = selectedBuild;
    const cost = prices[type];

    if (money < cost) {
      say("Not enough money!");
      return;
    }

    if (blocked(p.x, p.y, 24)) {
      say("That location is occupied!");
      return;
    }

    money -= cost;
    buildings.push(makeBuilding(type, p.x, p.y));
    selectedBuild = null;
    selected = buildings[buildings.length - 1];

    say(info[type].name + " constructed!");
    updateUI();
    return;
  }

  selected = null;

  for (const b of buildings) {
    if (distance(p, b) < b.size) {
      selected = b;
      break;
    }
  }

  if (!selected) {
    for (const u of units) {
      if (distance(p, u) < 20) {
        selected = u;
        break;
      }
    }
  }

  updateSelection();
});

canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
  selectedBuild = null;
  say("Building placement cancelled.");
});

function upgradeBuilding() {
  if (!selected || selected.team !== "player" ||
      !selected.type || selected.type === "hq") return;

  const cost = selected.level * 150;

  if (money < cost) {
    say("Not enough money to upgrade!");
    return;
  }

  money -= cost;
  selected.level++;
  selected.maxHp = Math.round(selected.maxHp * 1.25);
  selected.hp = selected.maxHp;

  say("Building upgraded to level " + selected.level + "!");
  updateUI();
  updateSelection();
}

function sellBuilding() {
  if (!selected || selected.team !== "player" ||
      selected.type === "hq") return;

  const index = buildings.indexOf(selected);
  if (index < 0) return;

  money += Math.floor(prices[selected.type] * 0.6);
  buildings.splice(index, 1);
  selected = null;

  say("Building sold.");
  updateUI();
  updateSelection();
}

function updateSelection() {
  const el = document.getElementById("selection");
  const upgrade = document.getElementById("upgradeBtn");

  if (!selected) {
    el.textContent = "Nothing selected";
    upgrade.disabled = true;
    return;
  }

  if (selected.type) {
    el.innerHTML =
      "<b>" + info[selected.type].name + "</b><br>" +
      "Health: " + Math.ceil(selected.hp) + "/" +
      selected.maxHp + "<br>" +
      "Level: " + selected.level;

    upgrade.disabled =
      selected.team !== "player" ||
      selected.type === "hq";
  } else {
    el.innerHTML =
      "<b>" + selected.team + " soldier</b><br>" +
      "Health: " + Math.ceil(selected.hp) + "/" +
      selected.maxHp;

    upgrade.disabled = true;
  }
}

function updateUI() {
  document.getElementById("money").textContent = Math.floor(money);
  document.getElementById("kills").textContent = kills;

  let income = 0;
  for (const b of buildings) {
    if (b.team === "player") {
      income += (info[b.type].income || 0) * b.level;
    }
  }

  document.getElementById("income").textContent = income;
  document.getElementById("soldiers").textContent =
    units.filter(u => u.team === "player").length;
  document.getElementById("enemies").textContent =
    units.filter(u => u.team === "enemy").length;

  const enemyHQ = buildings.find(b =>
    b.type === "hq" && b.team === "enemy"
  );

  document.getElementById("enemyHealth").textContent =
    enemyHQ ? Math.ceil(enemyHQ.hp) : 0;

  document.getElementById("wave").textContent = wave;
}

function nearestTarget(unit) {
  const enemies = unit.team === "player" ? "enemy" : "player";

  const candidates = [
    ...units.filter(u => u.team === enemies),
    ...buildings.filter(b =>
      b.team === enemies && b.hp > 0
    )
  ];

  if (candidates.length === 0) return null;

  let best = null;
  let bestDistance = Infinity;

  for (const obj of candidates) {
    const d = distance(unit, obj);
    if (d < bestDistance) {
      bestDistance = d;
      best = obj;
    }
  }

  return best;
}

function spawnSoldier(building, team) {
  const u = makeUnit(
    building.x + (Math.random() - 0.5) * 70,
    building.y + 45,
    team
  );

  if (team === "enemy") {
    u.hp = 85 + wave * 4;
    u.maxHp = u.hp;
    u.damage = 10 + wave;
    u.speed = 42 + wave * 1.2;
  }

  units.push(u);
}

function shoot(source, target, damage, team) {
  bullets.push({
    x: source.x,
    y: source.y,
    target,
    damage,
    team,
    speed: 350
  });
}

function update(dt) {
  if (gameOver) return;

  elapsed += dt;

  incomeTimer += dt;
  if (incomeTimer >= 1) {
    incomeTimer -= 1;

    for (const b of buildings) {
      if (b.team === "player") {
        money += info[b.type].income || 0;
        money += (info[b.type].income || 0) * (b.level - 1);
      }
    }

    updateUI();
  }

  // Factories and barracks produce resources and soldiers.
  for (const b of buildings) {
    b.cooldown -= dt;
    b.spawnTimer += dt;

    if (b.type === "barracks" && b.spawnTimer > 5) {
      b.spawnTimer = 0;
      if (b.team === "player") {
        spawnSoldier(b, "player");
      }
    }

    if (b.type === "turret" || b.type === "bunker") {
      if (b.cooldown <= 0) {
        const range = info[b.type].range * b.level;

        let target = null;
        let best = range;

        for (const u of units) {
          if (u.team === b.team) continue;

          const d = distance(b, u);
          if (d < best) {
            best = d;
            target = u;
          }
        }

        if (target) {
          const damage = info[b.type].damage * b.level;
          shoot(b, target, damage, b.team);
          b.cooldown = b.type === "turret" ? 0.55 : 1.1;
        }
      }
    }
  }

  // AI builds an army and sends waves toward the player.
  aiTimer -= dt;

  if (aiTimer <= 0) {
    aiTimer = Math.max(3, 10 - wave * 0.4);

    const enemyHQ = buildings.find(b =>
      b.type === "hq" && b.team === "enemy"
    );

    if (enemyHQ) {
      const enemyBarracks = buildings.find(b =>
        b.type === "barracks" && b.team === "enemy"
      );

      if (!enemyBarracks) {
        buildings.push(makeBuilding(
          "barracks",
          enemyHQ.x - 80,
          enemyHQ.y + 80,
          "enemy"
        ));
      } else {
        const count = Math.min(3 + wave, 12);
        for (let i = 0; i < count; i++) {
          spawnSoldier(enemyHQ, "enemy");
        }
      }

      if (wave % 3 === 0) {
        buildings.push(makeBuilding(
          "turret",
          enemyHQ.x + (Math.random() - 0.5) * 180,
          enemyHQ.y - 100,
          "enemy"
        ));
      }

      wave++;
      say("Enemy attack wave " + wave + " is approaching!");
    }
  }

  // Soldier movement and combat.
  for (const u of units) {
    u.cooldown -= dt;

    const target = nearestTarget(u);
    if (!target) continue;

    const d = distance(u, target);
    const attackRange = target.type ? 45 : u.range;

    if (d > attackRange) {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const len = Math.hypot(dx, dy) || 1;

      const nx = u.x + dx / len * u.speed * dt;
      const ny = u.y + dy / len * u.speed * dt;

      if (!blocked(nx, ny, u.size)) {
        u.x = nx;
        u.y = ny;
      } else {
        const sideX = nx + Math.cos(elapsed * 2) * u.speed * dt;
        const sideY = ny + Math.sin(elapsed * 2) * u.speed * dt;

        if (!blocked(sideX, sideY, u.size)) {
          u.x = sideX;
          u.y = sideY;
        }
      }
    } else if (u.cooldown <= 0) {
      shoot(u, target, u.damage, u.team);
      u.cooldown = 0.8;
    }
  }

  // Bullets follow their targets.
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const target = bullet.target;

    if (!target || target.hp <= 0) {
      bullets.splice(i, 1);
      continue;
    }

    const dx = target.x - bullet.x;
    const dy = target.y - bullet.y;
    const d = Math.hypot(dx, dy) || 1;

    if (d < 12) {
      target.hp -= bullet.damage;

      if (target.hp <= 0 && target.team === "enemy") {
        if (!target.type) {
          kills++;
          money += 15;
        }

        if (target.type === "hq") {
          gameOver = true;
          say("VICTORY! You destroyed the enemy headquarters!");
        }
      }

      bullets.splice(i, 1);
    } else {
      bullet.x += dx / d * bullet.speed * dt;
      bullet.y += dy / d * bullet.speed * dt;
    }
  }

  // Remove destroyed units and buildings.
  units = units.filter(u => u.hp > 0);

  const deadBuildings = buildings.filter(b => b.hp <= 0);

  for (const b of deadBuildings) {
    if (b.type === "hq" && b.team === "player") {
      gameOver = true;
      say("DEFEAT! Your headquarters was destroyed.");
    }
  }

  buildings = buildings.filter(b => b.hp > 0);

  // Particle effects.
  particles = particles.filter(p => {
    p.life -= dt;
    return p.life > 0;
  });

  if (messageTimer > 0) {
    messageTimer -= dt;
  }

  updateUI();

  if (selected && selected.hp <= 0) {
    selected = null;
    updateSelection();
  }
}

// Camera controls.
const keys = {};

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  if (e.key === "Escape") {
    selectedBuild = null;
    say("Placement cancelled.");
  }
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

function moveCamera(dt) {
  const speed = 450 * dt;

  if (keys.w || keys.arrowup) camera.y -= speed;
  if (keys.s || keys.arrowdown) camera.y += speed;
  if (keys.a || keys.arrowleft) camera.x -= speed;
  if (keys.d || keys.arrowright) camera.x += speed;

  const rect = canvas.getBoundingClientRect();

  camera.x = Math.max(0, Math.min(
    WORLD_W - rect.width, camera.x
  ));

  camera.y = Math.max(0, Math.min(
    WORLD_H - rect.height, camera.y
  ));
}

function drawHealth(x, y, hp, maxHp, width = 38) {
  ctx.fillStyle = "#252525";
  ctx.fillRect(x - width / 2, y, width, 5);

  ctx.fillStyle = hp / maxHp > 0.5 ? "#57d957" : "#ed4a38";
  ctx.fillRect(x - width / 2, y, width * Math.max(0, hp / maxHp), 5);
}

function render() {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // Ground.
  ctx.fillStyle = "#718c52";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Grid.
  ctx.strokeStyle = "#ffffff12";
  ctx.lineWidth = 1;

  for (let x = 0; x <= WORLD_W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_H);
    ctx.stroke();
  }

  for (let y = 0; y <= WORLD_H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }

  // Roads.
  ctx.fillStyle = "#99917a";
  ctx.fillRect(0, 760, WORLD_W, 90);
  ctx.fillRect(1050, 0, 90, WORLD_H);

  ctx.strokeStyle = "#ddd0a0";
  ctx.setLineDash([25, 20]);
  ctx.beginPath();
  ctx.moveTo(0, 805);
  ctx.lineTo(WORLD_W, 805);
  ctx.moveTo(1095, 0);
  ctx.lineTo(1095, WORLD_H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Battlefield trees.
  for (let x = 100; x < WORLD_W; x += 240) {
    for (let y = 100; y < WORLD_H; y += 230) {
      if ((x * 7 + y * 3) % 5 !== 0) {
        ctx.fillStyle = "#465e34";
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#567b3c";
        ctx.beginPath();
        ctx.arc(x - 5, y - 6, 17, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Territory markers.
  ctx.fillStyle = "#e6ca3c18";
  ctx.fillRect(150, 150, 450, 400);
  ctx.fillStyle = "#d94c4c18";
  ctx.fillRect(1600, 1050, 450, 400);

  // Buildings.
  for (const b of buildings) {
    const data = buildingsData[b.type];

    ctx.fillStyle = b.team === "player" ? "#e4ce45" : "#c84b48";
    ctx.fillRect(b.x - b.size / 2 - 4, b.y - b.size / 2 - 4,
      b.size + 8, b.size + 8);

    ctx.fillStyle = data.color;
    ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2,
      b.size, b.size);

    ctx.strokeStyle = b.team === "player" ? "#fff1a0" : "#ffaaaa";
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - b.size / 2, b.y - b.size / 2,
      b.size, b.size);

    ctx.font = "26px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.symbol, b.x, b.y);

    drawHealth(b.x, b.y + b.size / 2 + 5, b.hp, b.maxHp);

    if (b.level > 1) {
      ctx.fillStyle = "white";
      ctx.font = "12px Arial";
      ctx.fillText("Lv." + b.level, b.x, b.y - b.size / 2 - 9);
    }

    if (selected === b) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x - b.size / 2 - 8,
        b.y - b.size / 2 - 8, b.size + 16, b.size + 16);
    }
  }

  // Soldiers.
  for (const u of units) {
    ctx.fillStyle = u.team === "player" ? "#2869e9" : "#d62f2f";
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#252525";
    ctx.fillRect(u.x - 5, u.y - 3, 10, 4);

    drawHealth(u.x, u.y + 15, u.hp, u.maxHp, 25);

    if (selected === u) {
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      ctx.arc(u.x, u.y, 17, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Bullets.
  ctx.fillStyle = "#ffe05b";
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Placement preview.
  if (selectedBuild) {
    const rect2 = canvas.getBoundingClientRect();
    const previewX = window.mouseX + camera.x;
    const previewY = window.mouseY + camera.y;

    if (Number.isFinite(previewX) && Number.isFinite(previewY)) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = blocked(previewX, previewY, 24) ?
        "#ff3333" : "#55ff55";
      ctx.fillRect(previewX - 24, previewY - 24, 48, 48);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

window.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  window.mouseX = e.clientX - rect.left;
  window.mouseY = e.clientY - rect.top;
});

function saveGame() {
  const data = {
    money, kills, wave, buildings, units, elapsed,
    aiTimer, incomeTimer
  };

  try {
    localStorage.setItem("bananaFrontSave", JSON.stringify(data));
    say("Game saved!");
  } catch (e) {
    say("Could not save game.");
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem("bananaFrontSave");
    if (!raw) {
      say("No saved game found!");
      return;
    }

    const data = JSON.parse(raw);

    if (!Array.isArray(data.buildings) ||
        !Array.isArray(data.units) ||
        !Number.isFinite(data.money)) {
      throw new Error("Invalid save");
    }

    money = data.money;
    kills = data.kills || 0;
    wave = data.wave || 1;
    buildings = data.buildings;
    units = data.units;
    elapsed = data.elapsed || 0;
    aiTimer = data.aiTimer || 5;
    incomeTimer = data.incomeTimer || 0;
    bullets = [];
    selected = null;
    selectedBuild = null;
    gameOver = false;

    updateUI();
    updateSelection();
    say("Game loaded!");
  } catch (e) {
    say("Save file could not be loaded.");
  }
}

function restartGame() {
  if (confirm("Restart Banana Front? Your current game will be lost.")) {
    resetGame();
  }
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.05);
  lastTime = timestamp;

  moveCamera(dt);
  update(dt);
  render();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

updateUI();
