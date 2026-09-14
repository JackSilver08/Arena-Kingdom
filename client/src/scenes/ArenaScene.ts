import Phaser from 'phaser';
import { ArmySelection, BuildingType, GAME_RULES, type PlayerId, type Vec2 } from '@arena-kingdom/shared';

interface BuildingRuntime {
  id: string;
  owner: PlayerId;
  type: BuildingType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  emoji: string;
  visual: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

interface UnitRuntime {
  id: string;
  owner: PlayerId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  target: Vec2 | null;
  visual: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
}

type Mode = 'idle' | 'build' | 'troops';

const W = GAME_RULES.map.width;
const H = GAME_RULES.map.height;
const ARENA = GAME_RULES.map.arena;
const COLORS = {
  water: 0x071a2d,
  water2: 0x0b2740,
  land: 0x274d3a,
  landLight: 0x345f45,
  border: 0x9ac7aa,
  panel: 0x091521,
  panel2: 0x102338,
  line: 0x29445d,
  text: 0xeaf5ff,
  muted: 0x9db2c6,
  blue: 0x4ea7ff,
  red: 0xff6f75,
  gold: 0xffcc4d,
  green: 0x62d68b,
  danger: 0xff737a
} as const;

const BUILD_OPTIONS = [
  { type: BuildingType.Village, label: 'Village', icon: '🏠', cost: GAME_RULES.economy.villageCost, hp: GAME_RULES.combat.villageHp },
  { type: BuildingType.Barracks, label: 'Barracks', icon: '⚔️', cost: 120, hp: GAME_RULES.combat.barracksHp },
  { type: BuildingType.Tower, label: 'Tower', icon: '🗼', cost: 150, hp: GAME_RULES.combat.towerHp }
] as const;

export class ArenaScene extends Phaser.Scene {
  private readonly player: PlayerId = 'playerA';
  private gold = GAME_RULES.economy.startingGold;
  private income = 0;
  private mode: Mode = 'idle';
  private selectedArmy: ArmySelection = ArmySelection.All;
  private nextIncomeAt = 0;
  private nextRecruitAt = 0;
  private buildings: BuildingRuntime[] = [];
  private units: UnitRuntime[] = [];
  private modeText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private incomeText!: Phaser.GameObjects.Text;
  private armyText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private buildPanel?: Phaser.GameObjects.Container;
  private troopPanel?: Phaser.GameObjects.Container;
  private messengerPanel?: Phaser.GameObjects.Container;
  private placementPreview?: Phaser.GameObjects.Text;
  private gameOver = false;

  constructor() {
    super('ArenaScene');
  }

  create() {
    this.drawWorld();
    this.createInitialKingdoms();
    this.createHud();
    this.createCommandRail();
    this.createInput();
    this.nextIncomeAt = this.time.now + GAME_RULES.economy.incomeIntervalMs;
    this.income = this.countBuildings(this.player, BuildingType.Village) * GAME_RULES.economy.villageIncome;
    this.updateHud();
  }

  update(time: number, delta: number) {
    if (this.gameOver) return;
    if (time >= this.nextIncomeAt) {
      this.gold += this.income;
      this.nextIncomeAt = time + GAME_RULES.economy.incomeIntervalMs;
      this.updateHud();
    }
    if (time >= this.nextRecruitAt) this.updateRecruitVisual(time);
    this.updateUnits(delta);
    this.updatePlacementPreview();
  }

  private drawWorld() {
    this.add.rectangle(W / 2, H / 2, W, H, COLORS.water);
    const g = this.add.graphics();
    g.fillStyle(COLORS.water2, 1);
    for (let x = 0; x < W; x += 90) {
      for (let y = 0; y < H; y += 54) {
        g.fillCircle(x + ((y / 54) % 2) * 24, y + 18, 1.5);
      }
    }

    g.fillStyle(COLORS.land, 1);
    g.fillRoundedRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height, 30);
    g.lineStyle(4, COLORS.border, 0.45);
    g.strokeRoundedRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height, 30);

    g.lineStyle(2, 0xddeee5, 0.12);
    for (let x = ARENA.x + 20; x < ARENA.x + ARENA.width; x += 40) g.lineBetween(x, ARENA.y + 12, x, ARENA.y + ARENA.height - 12);
    for (let y = ARENA.y + 20; y < ARENA.y + ARENA.height; y += 40) g.lineBetween(ARENA.x + 12, y, ARENA.x + ARENA.width - 12, y);

    const middle = GAME_RULES.map.midlineY;
    g.lineStyle(3, 0xeaf5ff, 0.18);
    g.lineBetween(ARENA.x + 16, middle, ARENA.x + ARENA.width - 16, middle);
    g.fillStyle(0x06101a, 0.75);
    g.fillRoundedRect(ARENA.x + 128, middle - 18, 244, 36, 18);
    this.add.text(ARENA.x + ARENA.width / 2, middle, '⚔️  CONTESTED CENTER  ⚔️', {
      fontFamily: 'Segoe UI Emoji', fontSize: '12px', fontStyle: 'bold', color: '#dcecff', letterSpacing: 1
    }).setOrigin(0.5);

    this.add.text(ARENA.x + 18, ARENA.y + 14, 'BLUE KINGDOM', { fontSize: '11px', fontStyle: 'bold', color: '#cfe8ff', letterSpacing: 2 });
    this.add.text(ARENA.x + 18, ARENA.y + ARENA.height - 30, 'RED KINGDOM', { fontSize: '11px', fontStyle: 'bold', color: '#ffd9dc', letterSpacing: 2 });

    this.add.text(92, 108, 'ISLAND ARENA', { fontSize: '11px', fontStyle: 'bold', color: '#7894ad', letterSpacing: 3 });
    this.add.text(92, 122, 'One island · Two rulers · One throne', { fontSize: '12px', color: '#55728c' });

    this.add.text(947, 105, 'LIVE PROTOTYPE', { fontSize: '10px', fontStyle: 'bold', color: '#75d8a0', backgroundColor: '#0c2b1e', padding: { x: 7, y: 4 } });
  }

  private createInitialKingdoms() {
    const center = ARENA.x + ARENA.width / 2;
    this.spawnBuilding('a-castle', 'playerA', BuildingType.Castle, center, ARENA.y + 62, GAME_RULES.combat.castleHp, '🏰');
    this.spawnBuilding('a-village-1', 'playerA', BuildingType.Village, center - 145, ARENA.y + 118, GAME_RULES.combat.villageHp, '🏠');
    this.spawnBuilding('a-village-2', 'playerA', BuildingType.Village, center + 145, ARENA.y + 118, GAME_RULES.combat.villageHp, '🏠');
    this.spawnBuilding('a-barracks', 'playerA', BuildingType.Barracks, center, ARENA.y + 176, GAME_RULES.combat.barracksHp, '⚔️');

    this.spawnBuilding('b-castle', 'playerB', BuildingType.Castle, center, ARENA.y + ARENA.height - 62, GAME_RULES.combat.castleHp, '🏰');
    this.spawnBuilding('b-village-1', 'playerB', BuildingType.Village, center - 145, ARENA.y + ARENA.height - 118, GAME_RULES.combat.villageHp, '🏠');
    this.spawnBuilding('b-village-2', 'playerB', BuildingType.Village, center + 145, ARENA.y + ARENA.height - 118, GAME_RULES.combat.villageHp, '🏠');
    this.spawnBuilding('b-barracks', 'playerB', BuildingType.Barracks, center, ARENA.y + ARENA.height - 176, GAME_RULES.combat.barracksHp, '⚔️');

    for (let i = 0; i < 4; i++) {
      this.spawnUnit('playerA', center - 34 + i * 23, ARENA.y + 228, `a-u-${i}`);
      this.spawnUnit('playerB', center - 34 + i * 23, ARENA.y + ARENA.height - 228, `b-u-${i}`);
    }
  }

  private spawnBuilding(id: string, owner: PlayerId, type: BuildingType, x: number, y: number, hp: number, emoji: string) {
    const size = type === BuildingType.Castle ? '54px' : type === BuildingType.Tower ? '38px' : '39px';
    const visual = this.add.text(x, y, emoji, {
      fontFamily: 'Segoe UI Emoji', fontSize: size, stroke: '#06121d', strokeThickness: 6
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const labelMap: Record<BuildingType, string> = {
      [BuildingType.Castle]: 'MAIN CASTLE',
      [BuildingType.Village]: 'VILLAGE',
      [BuildingType.Barracks]: 'BARRACKS',
      [BuildingType.Tower]: 'TOWER'
    };
    const label = this.add.text(x, y + (type === BuildingType.Castle ? 43 : 33), labelMap[type], {
      fontSize: '8px', fontStyle: 'bold', color: owner === 'playerA' ? '#bcdfff' : '#ffd1d5', letterSpacing: 1
    }).setOrigin(0.5);
    const bar = this.add.graphics();
    const building = { id, owner, type, x, y, hp, maxHp: hp, emoji, visual, bar, label };
    this.buildings.push(building);
    this.drawHealthBar(bar, x, y - (type === BuildingType.Castle ? 39 : 30), hp, hp, owner);

    visual.on('pointerdown', () => {
      if (owner !== this.player || type !== BuildingType.Barracks || this.mode !== 'idle') return;
      this.recruitAtBarracks(building);
    });
  }

  private spawnUnit(owner: PlayerId, x: number, y: number, id: string) {
    const visual = this.add.text(x, y, owner === 'playerA' ? '🔵⚔️' : '🔴⚔️', {
      fontFamily: 'Segoe UI Emoji', fontSize: '17px', stroke: '#06121d', strokeThickness: 3
    }).setOrigin(0.5);
    const bar = this.add.graphics();
    const unit: UnitRuntime = { id, owner, x, y, hp: GAME_RULES.combat.soldierHp, maxHp: GAME_RULES.combat.soldierHp, target: null, visual, bar };
    this.units.push(unit);
    this.drawHealthBar(bar, x, y - 15, unit.hp, unit.maxHp, owner);
  }

  private createHud() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.96);
    g.fillRect(0, 0, W, 82);
    g.lineStyle(1, COLORS.line, 1);
    g.lineBetween(0, 81, W, 81);

    this.add.text(26, 15, '🏰', { fontFamily: 'Segoe UI Emoji', fontSize: '25px' });
    this.add.text(60, 12, 'ARENA KINGDOM', { fontSize: '14px', fontStyle: 'bold', color: '#f0f7ff', letterSpacing: 2 });
    this.add.text(60, 35, 'BLUE KINGDOM', { fontSize: '9px', fontStyle: 'bold', color: '#69b6ff', letterSpacing: 2 });

    this.goldText = this.add.text(242, 18, '', { fontFamily: 'Segoe UI Emoji', fontSize: '20px', fontStyle: 'bold', color: '#ffe091' });
    this.incomeText = this.add.text(244, 46, '', { fontSize: '10px', color: '#91a9bf' });

    this.armyText = this.add.text(412, 22, '', { fontSize: '11px', fontStyle: 'bold', color: '#dcecff' });
    this.enemyHpText = this.add.text(548, 22, '', { fontSize: '11px', fontStyle: 'bold', color: '#ffd9dc' });

    this.modeText = this.add.text(1010, 19, 'IDLE', { fontSize: '11px', fontStyle: 'bold', color: '#8aa3b9', backgroundColor: '#111f2d', padding: { x: 9, y: 6 } });
    this.add.text(1090, 20, 'B  BUILD', { fontSize: '10px', fontStyle: 'bold', color: '#8fa7bc' });
    this.add.text(1173, 20, 'T  TROOPS', { fontSize: '10px', fontStyle: 'bold', color: '#8fa7bc' });
    this.add.text(1260, 20, 'M', { fontSize: '10px', fontStyle: 'bold', color: '#8fa7bc' }).setOrigin(0.5);
  }

  private createCommandRail() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.97);
    g.fillRect(22, 540, 1236, 150);
    g.lineStyle(1, COLORS.line, 1);
    g.strokeRect(22, 540, 1236, 150);

    this.add.text(43, 555, 'COMMAND CENTER', { fontSize: '10px', fontStyle: 'bold', color: '#66839b', letterSpacing: 2 });
    this.hintText = this.add.text(43, 576, 'Choose an order. The battlefield remains yours to command.', { fontSize: '12px', color: '#c1d2e2' });

    const buttons = [
      ['B', 'Build', 42, COLORS.blue],
      ['T', 'Troops', 120, COLORS.gold],
      ['M', 'Messenger', 210, 0xb18dff]
    ];
    for (const [key, label, x, color] of buttons as Array<[string, string, number, number]>) {
      g.fillStyle(COLORS.panel2, 1);
      g.fillRoundedRect(x, 618, 102, 48, 9);
      g.lineStyle(1, color, 0.34);
      g.strokeRoundedRect(x, 618, 102, 48, 9);
      this.add.text(x + 15, 625, key, { fontSize: '17px', fontStyle: 'bold', color: '#f4f8ff' });
      this.add.text(x + 42, 629, label.toUpperCase(), { fontSize: '9px', fontStyle: 'bold', color: '#8198ad', letterSpacing: 1 });
    }

    this.add.text(430, 626, 'Recruit: click ⚔️ Barracks', { fontSize: '10px', color: '#718ba2' });
    this.add.text(430, 645, 'Build: B → choose structure → place in your territory', { fontSize: '10px', color: '#718ba2' });
    this.add.text(430, 664, 'Troops: T → select force → click destination', { fontSize: '10px', color: '#718ba2' });
    this.add.text(1035, 626, 'ESC', { fontSize: '10px', fontStyle: 'bold', color: '#d2deea' });
    this.add.text(1070, 626, 'Cancel order', { fontSize: '10px', color: '#718ba2' });
    this.add.text(1035, 646, 'M', { fontSize: '10px', fontStyle: 'bold', color: '#d2deea' });
    this.add.text(1070, 646, 'Messenger', { fontSize: '10px', color: '#718ba2' });
  }

  private createInput() {
    this.input.keyboard?.on('keydown-B', () => this.openBuildMenu());
    this.input.keyboard?.on('keydown-T', () => this.openTroopMenu());
    this.input.keyboard?.on('keydown-M', () => this.toggleMessenger());
    this.input.keyboard?.on('keydown-ESC', () => this.cancelModes());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 || this.gameOver || this.messengerPanel || this.buildPanel || this.troopPanel) return;
      if (pointer.worldY < ARENA.y || pointer.worldY > ARENA.y + ARENA.height) return;
      if (this.mode === 'build') this.placeBuilding(pointer.worldX, pointer.worldY);
      else if (this.mode === 'troops') this.commandTroops(pointer.worldX, pointer.worldY);
    });
  }

  private openBuildMenu() {
    this.cancelAuxPanels();
    this.mode = 'build';
    this.modeText.setText('BUILD');
    this.hintText.setText('Select a structure, then click anywhere inside the BLUE territory.');
    const panel = this.add.container(982, 128);
    const bg = this.add.rectangle(0, 0, 258, 206, COLORS.panel, 0.98).setOrigin(0).setStrokeStyle(1, COLORS.line);
    panel.add(bg);
    panel.add(this.add.text(18, 14, 'BUILD MENU', { fontSize: '11px', fontStyle: 'bold', color: '#dcecff', letterSpacing: 1 }));
    BUILD_OPTIONS.forEach((item, index) => {
      const y = 46 + index * 50;
      const row = this.add.rectangle(12, y, 234, 42, COLORS.panel2, 1).setOrigin(0).setInteractive({ useHandCursor: true });
      const icon = this.add.text(23, y + 7, item.icon, { fontFamily: 'Segoe UI Emoji', fontSize: '21px' });
      const name = this.add.text(55, y + 7, item.label, { fontSize: '11px', fontStyle: 'bold', color: '#eaf5ff' });
      const cost = this.add.text(204, y + 8, `${item.cost}g`, { fontSize: '10px', fontStyle: 'bold', color: '#ffd781' }).setOrigin(1, 0);
      row.on('pointerdown', () => this.selectBuildOption(item.type, item.cost, item.icon));
      panel.add([row, icon, name, cost]);
    });
    this.buildPanel = panel;
    this.selectBuildOption(BuildingType.Village, GAME_RULES.economy.villageCost, '🏠');
  }

  private selectBuildOption(type: BuildingType, cost: number, icon: string) {
    if (!this.buildPanel) return;
    const data = BUILD_OPTIONS.find((item) => item.type === type);
    if (!data || this.gold < cost) {
      this.hintText.setText(`Not enough gold to build ${data?.label ?? type}.`);
      return;
    }
    this.placementPreview?.destroy();
    this.placementPreview = this.add.text(0, 0, icon, { fontFamily: 'Segoe UI Emoji', fontSize: data.type === BuildingType.Castle ? '46px' : '38px', alpha: 0.45 });
    this.hintText.setText(`Building ${data.label}: click your territory to place it.`);
  }

  private placeBuilding(x: number, y: number) {
    const data = BUILD_OPTIONS.find((item) => item.type === BuildingType.Village || true);
    const selectedText = this.placementPreview?.text;
    const selected = BUILD_OPTIONS.find((item) => item.icon === selectedText) ?? BUILD_OPTIONS[0];
    if (!this.isInPlayerTerritory(x, y)) return this.hintText.setText('You can only build inside the BLUE territory.');
    if (this.gold < selected.cost) return this.hintText.setText(`Need ${selected.cost} gold.`);
    if (this.buildings.some((b) => Phaser.Math.Distance.Between(b.x, b.y, x, y) < 54 && b.hp > 0)) return this.hintText.setText('That construction site is occupied.');

    const maxY = GAME_RULES.map.midlineY - 24;
    const safeY = Math.min(y, maxY);
    this.gold -= selected.cost;
    this.spawnBuilding(`a-${selected.type}-${Date.now()}`, this.player, selected.type, x, safeY, selected.hp, selected.icon);
    this.mode = 'idle';
    this.modeText.setText('IDLE');
    this.placementPreview?.destroy();
    this.placementPreview = undefined;
    this.buildPanel?.destroy();
    this.buildPanel = undefined;
    this.recalculateIncome();
    this.hintText.setText(`${selected.label} constructed. Your kingdom expands.`);
    this.updateHud();
  }

  private openTroopMenu() {
    this.cancelAuxPanels();
    this.mode = 'troops';
    this.modeText.setText('TROOPS');
    this.hintText.setText('Choose how much of your army to command, then click a destination.');
    const panel = this.add.container(982, 128);
    panel.add(this.add.rectangle(0, 0, 258, 178, COLORS.panel, 0.98).setOrigin(0).setStrokeStyle(1, COLORS.line));
    panel.add(this.add.text(18, 14, 'TROOP COMMAND', { fontSize: '11px', fontStyle: 'bold', color: '#dcecff', letterSpacing: 1 }));
    const choices: Array<[string, ArmySelection]> = [['ALL', ArmySelection.All], ['1 / 3', ArmySelection.OneThird], ['2 / 3', ArmySelection.TwoThirds]];
    choices.forEach(([label, value], index) => {
      const y = 48 + index * 38;
      const row = this.add.rectangle(12, y, 234, 32, value === this.selectedArmy ? 0x153650 : COLORS.panel2, 1).setOrigin(0).setInteractive({ useHandCursor: true });
      row.on('pointerdown', () => {
        this.selectedArmy = value;
        this.hintText.setText(`${label} of your army selected. Click a destination.`);
        panel.destroy();
        this.troopPanel = undefined;
      });
      panel.add(row);
      panel.add(this.add.text(28, y + 8, label, { fontSize: '11px', fontStyle: 'bold', color: '#eef7ff' }));
    });
    this.troopPanel = panel;
  }

  private commandTroops(x: number, y: number) {
    const army = this.units.filter((unit) => unit.owner === this.player && unit.hp > 0 && unit.target === null);
    if (!army.length) {
      this.hintText.setText('No available troops.');
      return;
    }
    const fraction = this.selectedArmy === ArmySelection.All ? 1 : this.selectedArmy === ArmySelection.OneThird ? 1 / 3 : 2 / 3;
    const amount = Math.max(1, Math.ceil(army.length * fraction));
    army.slice(0, amount).forEach((unit, index) => {
      unit.target = { x: x + (index % 3) * 20 - 20, y: y + Math.floor(index / 3) * 18 - 9 };
    });
    this.mode = 'idle';
    this.modeText.setText('IDLE');
    this.hintText.setText(`${amount} troop(s) received their movement order.`);
    this.cancelAuxPanels();
  }

  private recruitAtBarracks(barracks: BuildingRuntime) {
    if (this.gold < GAME_RULES.economy.soldierCost) {
      this.hintText.setText('Not enough gold to recruit a Soldier.');
      return;
    }
    if (this.time.now < this.nextRecruitAt) {
      const remaining = Math.ceil((this.nextRecruitAt - this.time.now) / 100) / 10;
      this.hintText.setText(`Barracks training in progress: ${remaining}s`);
      return;
    }
    this.gold -= GAME_RULES.economy.soldierCost;
    const count = this.units.filter((unit) => unit.owner === this.player).length;
    this.spawnUnit(this.player, barracks.x - 54 + (count % 5) * 24, barracks.y + 40, `a-u-${Date.now()}`);
    this.nextRecruitAt = this.time.now + GAME_RULES.economy.soldierTrainMs;
    this.hintText.setText('Soldier recruited. Training lock is active briefly.');
    this.updateHud();
  }

  private updateRecruitVisual(time: number) {
    for (const building of this.buildings) {
      if (building.owner === this.player && building.type === BuildingType.Barracks && time >= this.nextRecruitAt) {
        building.visual.setScale(1);
      }
    }
  }

  private toggleMessenger() {
    if (this.messengerPanel) {
      this.messengerPanel.destroy();
      this.messengerPanel = undefined;
      return;
    }
    this.cancelAuxPanels();
    this.mode = 'idle';
    this.modeText.setText('IDLE');
    const panel = this.add.container(640, 360);
    panel.add(this.add.rectangle(0, 0, 440, 250, COLORS.panel, 0.99).setOrigin(0.5).setStrokeStyle(1, 0x4b6280));
    panel.add(this.add.text(0, -94, '✉️  MESSENGER', { fontFamily: 'Segoe UI Emoji', fontSize: '24px', fontStyle: 'bold', color: '#edf5ff' }).setOrigin(0.5));
    panel.add(this.add.text(0, -61, 'Diplomacy belongs on the battlefield too.', { fontSize: '11px', color: '#8ea5bb' }).setOrigin(0.5));

    const peace = this.makeActionButton(panel, -164, 12, 328, 42, '🤝  PROPOSE PEACE', 0x123525, '#a9e8be');
    const surrender = this.makeActionButton(panel, -164, 62, 328, 42, '🏳️  SURRENDER', 0x35171b, '#ffb3b9');
    const close = this.makeActionButton(panel, -80, 116, 160, 34, 'Close', COLORS.panel2, '#d8e5f1');
    peace.on('pointerdown', () => this.hintText.setText('Peace proposal queued. Online negotiation arrives with multiplayer.'));
    surrender.on('pointerdown', () => this.endGame('You surrendered.'));
    close.on('pointerdown', () => {
      panel.destroy();
      this.messengerPanel = undefined;
    });
    this.messengerPanel = panel;
  }

  private makeActionButton(panel: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, text: string, fill: number, color: string) {
    const bg = this.add.rectangle(x + w / 2, y, w, h, fill, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(1, 0xffffff, 0.1);
    panel.add(bg);
    panel.add(this.add.text(x + w / 2, y + h / 2, text, { fontFamily: 'Segoe UI Emoji', fontSize: '11px', fontStyle: 'bold', color }).setOrigin(0.5));
    return bg;
  }

  private updateUnits(delta: number) {
    const step = GAME_RULES.combat.soldierSpeed * delta / 1000;
    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      if (unit.target) {
        const d = Phaser.Math.Distance.Between(unit.x, unit.y, unit.target.x, unit.target.y);
        if (d <= 3) {
          unit.target = null;
        } else {
          const angle = Phaser.Math.Angle.Between(unit.x, unit.y, unit.target.x, unit.target.y);
          unit.x += Math.cos(angle) * Math.min(step, d);
          unit.y += Math.sin(angle) * Math.min(step, d);
          unit.visual.setPosition(unit.x, unit.y);
        }
      }

      this.drawHealthBar(unit.bar, unit.x, unit.y - 15, unit.hp, unit.maxHp, unit.owner);

      const enemy = this.buildings.find((building) => building.owner !== unit.owner && building.hp > 0 && Phaser.Math.Distance.Between(unit.x, unit.y, building.x, building.y) <= GAME_RULES.combat.soldierRange + 18);
      if (enemy) {
        enemy.hp -= GAME_RULES.combat.soldierAttack * delta / 1000;
        this.drawHealthBar(enemy.bar, enemy.x, enemy.y - (enemy.type === BuildingType.Castle ? 39 : 30), enemy.hp, enemy.maxHp, enemy.owner);
        if (enemy.hp <= 0) {
          enemy.visual.setAlpha(0.18);
          enemy.label.setAlpha(0.25);
          this.endGame(enemy.owner === this.player ? 'Defeat. Your kingdom has fallen.' : 'Victory! Enemy castle destroyed.');
          return;
        }
      }
    }
  }

  private drawHealthBar(bar: Phaser.GameObjects.Graphics, x: number, y: number, hp: number, maxHp: number, owner: PlayerId) {
    const width = 46;
    const height = 4;
    bar.clear();
    bar.fillStyle(0x061019, 0.9);
    bar.fillRoundedRect(x - width / 2, y, width, height, 2);
    bar.fillStyle(owner === 'playerA' ? COLORS.blue : COLORS.red, 1);
    bar.fillRoundedRect(x - width / 2, y, width * Phaser.Math.Clamp(hp / maxHp, 0, 1), height, 2);
  }

  private updatePlacementPreview() {
    if (!this.placementPreview) return;
    const pointer = this.input.activePointer;
    this.placementPreview.setPosition(pointer.worldX, pointer.worldY);
    const valid = this.isInPlayerTerritory(pointer.worldX, pointer.worldY) && !this.buildings.some((b) => Phaser.Math.Distance.Between(b.x, b.y, pointer.worldX, pointer.worldY) < 54 && b.hp > 0);
    this.placementPreview.setAlpha(valid ? 0.55 : 0.18);
  }

  private recalculateIncome() {
    this.income = this.countBuildings(this.player, BuildingType.Village) * GAME_RULES.economy.villageIncome;
  }

  private updateHud() {
    const villages = this.countBuildings(this.player, BuildingType.Village);
    const army = this.units.filter((unit) => unit.owner === this.player && unit.hp > 0).length;
    const enemyCastle = this.buildings.find((building) => building.owner !== this.player && building.type === BuildingType.Castle);
    this.goldText.setText(`💰 ${this.gold}`);
    this.incomeText.setText(`+${this.income} gold / 5s  ·  ${villages} village${villages === 1 ? '' : 's'}`);
    this.armyText.setText(`⚔️ Army ${army}`);
    this.enemyHpText.setText(`🏰 Enemy Castle ${Math.max(0, Math.ceil(enemyCastle?.hp ?? 0))} HP`);
  }

  private isInPlayerTerritory(x: number, y: number) {
    return x >= ARENA.x + 18 && x <= ARENA.x + ARENA.width - 18 && y >= ARENA.y + 18 && y < GAME_RULES.map.midlineY - 22;
  }

  private countBuildings(owner: PlayerId, type: BuildingType) {
    return this.buildings.filter((building) => building.owner === owner && building.type === type && building.hp > 0).length;
  }

  private cancelAuxPanels() {
    this.buildPanel?.destroy();
    this.troopPanel?.destroy();
    this.buildPanel = undefined;
    this.troopPanel = undefined;
  }

  private cancelModes() {
    this.mode = 'idle';
    this.modeText.setText('IDLE');
    this.placementPreview?.destroy();
    this.placementPreview = undefined;
    this.cancelAuxPanels();
    this.hintText.setText('Orders cancelled. Choose your next move.');
  }

  private endGame(message: string) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.cancelModes();
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.68).setDepth(50);
    const panel = this.add.rectangle(W / 2, H / 2, 520, 250, COLORS.panel, 0.99).setDepth(51).setStrokeStyle(1, COLORS.line);
    const title = this.add.text(W / 2, H / 2 - 62, message, { fontSize: '30px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(52);
    this.add.text(W / 2, H / 2 - 15, 'Prototype battle complete', { fontSize: '12px', color: '#9eb4c9' }).setOrigin(0.5).setDepth(52);
    this.add.text(W / 2, H / 2 + 24, 'Refresh the page to restart the local match.', { fontSize: '11px', color: '#70889f' }).setOrigin(0.5).setDepth(52);
    this.add.text(W / 2, H / 2 + 72, '🏰  Arena Kingdom  ·  v0.2 battlefield prototype', { fontFamily: 'Segoe UI Emoji', fontSize: '10px', color: '#6d879f' }).setOrigin(0.5).setDepth(52);
    void overlay; void panel; void title;
  }
}
