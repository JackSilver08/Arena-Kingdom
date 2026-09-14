import Phaser from 'phaser';
import { BuildingType, GAME_RULES, type PlayerId, type Vec2 } from '@arena-kingdom/shared';

interface BuildingRuntime {
  id: string;
  owner: PlayerId;
  type: BuildingType;
  x: number;
  y: number;
  hp: number;
  visual: Phaser.GameObjects.Text;
}

interface UnitRuntime {
  id: string;
  owner: PlayerId;
  x: number;
  y: number;
  hp: number;
  target: Vec2 | null;
  visual: Phaser.GameObjects.Text;
}

type Mode = 'idle' | 'build' | 'troops';
type TroopSelection = 'all' | 'one-third' | 'two-thirds';

const ARENA = GAME_RULES.map.arena;

export class ArenaScene extends Phaser.Scene {
  private mode: Mode = 'idle';
  private troopSelection: TroopSelection = 'all';
  private player: PlayerId = 'playerA';
  private gold = GAME_RULES.economy.startingGold;
  private nextIncomeAt = 0;
  private buildings: BuildingRuntime[] = [];
  private units: UnitRuntime[] = [];
  private goldText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private messengerPanel?: Phaser.GameObjects.Container;
  private gameOver = false;

  constructor() {
    super('ArenaScene');
  }

  create() {
    this.drawWater();
    this.drawArena();
    this.createInitialKingdoms();
    this.createHud();
    this.createInput();
    this.nextIncomeAt = this.time.now + GAME_RULES.economy.incomeIntervalMs;
  }

  update(time: number, delta: number) {
    if (this.gameOver) return;
    if (time >= this.nextIncomeAt) {
      this.collectIncome();
      this.nextIncomeAt = time + GAME_RULES.economy.incomeIntervalMs;
    }
    this.updateUnits(delta);
  }

  private drawWater() {
    this.add.rectangle(640, 360, 1280, 720, 0x2487f5);
    const waveStyle = { fontFamily: 'Segoe UI Emoji', fontSize: '26px', color: '#ffffff' };
    this.add.text(70, 145, '〰〰〰', waveStyle);
    this.add.text(1060, 280, '〰〰〰', waveStyle);
    this.add.text(75, 545, '〰〰〰', waveStyle);
    this.add.text(1060, 610, '〰〰〰', waveStyle);
  }

  private drawArena() {
    this.add.rectangle(ARENA.x + ARENA.width / 2, ARENA.y + ARENA.height / 2, ARENA.width, ARENA.height, 0x0bc26a);
    this.add.rectangle(ARENA.x + ARENA.width / 2, ARENA.y + ARENA.height / 2, ARENA.width, ARENA.height, 0x0bc26a, 0).setStrokeStyle(18, 0x2f8d43);
    this.add.line(0, 0, ARENA.x + 8, GAME_RULES.map.midlineY, ARENA.x + ARENA.width - 8, GAME_RULES.map.midlineY, 0x101820, 1).setLineWidth(3);
    this.add.text(ARENA.x + ARENA.width / 2, ARENA.y + 10, 'BLUE KINGDOM', { fontSize: '18px', fontStyle: 'bold', color: '#eaf9ff' }).setOrigin(0.5, 0);
    this.add.text(ARENA.x + ARENA.width / 2, ARENA.y + ARENA.height - 10, 'RED KINGDOM', { fontSize: '18px', fontStyle: 'bold', color: '#ffecec' }).setOrigin(0.5, 1);
    this.add.text(ARENA.x + ARENA.width / 2, GAME_RULES.map.midlineY, '⚔️  CONTESTED CENTER  ⚔️', {
      fontFamily: 'Segoe UI Emoji', fontSize: '16px', color: '#ffffff', backgroundColor: '#00000044', padding: { x: 8, y: 4 }
    }).setOrigin(0.5);
  }

  private createInitialKingdoms() {
    this.spawnBuilding('a-castle', 'playerA', BuildingType.Castle, ARENA.x + 250, ARENA.y + 56, 1200, '🏰');
    this.spawnBuilding('a-village-1', 'playerA', BuildingType.Village, ARENA.x + 105, ARENA.y + 122, 350, '🏠');
    this.spawnBuilding('a-village-2', 'playerA', BuildingType.Village, ARENA.x + 390, ARENA.y + 122, 350, '🏠');
    this.spawnBuilding('a-barracks', 'playerA', BuildingType.Barracks, ARENA.x + 250, ARENA.y + 154, 500, '⚔️');

    this.spawnBuilding('b-castle', 'playerB', BuildingType.Castle, ARENA.x + 250, ARENA.y + 484, 1200, '🏰');
    this.spawnBuilding('b-village-1', 'playerB', BuildingType.Village, ARENA.x + 105, ARENA.y + 416, 350, '🏠');
    this.spawnBuilding('b-village-2', 'playerB', BuildingType.Village, ARENA.x + 390, ARENA.y + 416, 350, '🏠');
    this.spawnBuilding('b-barracks', 'playerB', BuildingType.Barracks, ARENA.x + 250, ARENA.y + 386, 500, '⚔️');

    for (let i = 0; i < 3; i++) {
      this.spawnUnit('playerA', ARENA.x + 220 + i * 24, ARENA.y + 225, `a-u-${i}`);
      this.spawnUnit('playerB', ARENA.x + 220 + i * 24, ARENA.y + 315, `b-u-${i}`);
    }
  }

  private spawnBuilding(id: string, owner: PlayerId, type: BuildingType, x: number, y: number, hp: number, emoji: string) {
    const visual = this.add.text(x, y, emoji, {
      fontFamily: 'Segoe UI Emoji', fontSize: type === BuildingType.Castle ? '58px' : '42px',
      color: '#ffffff', stroke: '#0c1d29', strokeThickness: 5
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    visual.on('pointerdown', () => {
      if (owner === this.player && type === BuildingType.Barracks) this.recruitAtBarracks(x, y);
    });

    this.buildings.push({ id, owner, type, x, y, hp, visual });
  }

  private spawnUnit(owner: PlayerId, x: number, y: number, id: string) {
    const visual = this.add.text(x, y, owner === 'playerA' ? '🔵⚔️' : '🔴⚔️', {
      fontFamily: 'Segoe UI Emoji', fontSize: '18px'
    }).setOrigin(0.5);
    this.units.push({ id, owner, x, y, hp: GAME_RULES.combat.soldierHp, target: null, visual });
  }

  private createHud() {
    this.add.rectangle(1000, 34, 560, 60, 0xdce4ea).setOrigin(0, 0.5);
    this.add.text(1020, 18, '🏰  ARENA KINGDOM', { fontFamily: 'Segoe UI Emoji', fontSize: '18px', fontStyle: 'bold', color: '#18242d' });
    this.goldText = this.add.text(1190, 12, '', {
      fontFamily: 'Segoe UI Emoji', fontSize: '22px', fontStyle: 'bold', color: '#101010', backgroundColor: '#ffe400', padding: { x: 9, y: 4 }
    });
    this.modeText = this.add.text(28, 16, 'MODE: IDLE', { fontSize: '16px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#18242dcc', padding: { x: 8, y: 5 } });
    this.hintText = this.add.text(28, 650, 'B Build  •  T Troops  •  M Messenger  •  Click Barracks to recruit', {
      fontSize: '16px', color: '#ffffff', backgroundColor: '#18242dcc', padding: { x: 10, y: 8 }
    });
    this.updateHud();
  }

  private createInput() {
    this.input.keyboard?.on('keydown-B', () => this.enterBuildMode());
    this.input.keyboard?.on('keydown-T', () => this.enterTroopMode());
    this.input.keyboard?.on('keydown-M', () => this.toggleMessenger());
    this.input.keyboard?.on('keydown-ESC', () => this.setMode('idle'));

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 || this.messengerPanel) return;
      if (this.mode === 'build') this.tryBuild(pointer.worldX, pointer.worldY);
      else if (this.mode === 'troops') this.commandTroops(pointer.worldX, pointer.worldY);
    });
  }

  private enterBuildMode() {
    this.setMode('build');
    this.hintText.setText('BUILD: click your territory to place a Village • ESC cancel');
  }

  private enterTroopMode() {
    this.setMode('troops');
    this.troopSelection = 'all';
    this.hintText.setText('TROOPS: click a destination • default selection: ALL');
  }

  private tryBuild(x: number, y: number) {
    if (!this.isInPlayerTerritory(x, y)) return this.hintText.setText('Cannot build outside your kingdom.');
    if (this.gold < GAME_RULES.economy.villageCost) return this.hintText.setText('Not enough gold for a Village.');
    if (this.buildings.some((b) => Phaser.Math.Distance.Between(b.x, b.y, x, y) < 55)) return this.hintText.setText('Construction site is occupied.');

    this.gold -= GAME_RULES.economy.villageCost;
    this.spawnBuilding(`a-village-${Date.now()}`, this.player, BuildingType.Village, x, y, GAME_RULES.combat.villageHp, '🏠');
    this.setMode('idle');
    this.hintText.setText('Village constructed. Income upgraded.');
    this.updateHud();
  }

  private commandTroops(x: number, y: number) {
    const army = this.units.filter((unit) => unit.owner === this.player && unit.hp > 0);
    if (!army.length) return;
    const amount = this.troopSelection === 'all' ? army.length : Math.max(1, Math.ceil(army.length * (this.troopSelection === 'one-third' ? 1 / 3 : 2 / 3)));
    army.slice(0, amount).forEach((unit, index) => {
      unit.target = { x: x + (index % 3) * 18 - 18, y: y + Math.floor(index / 3) * 18 - 9 };
    });
    this.setMode('idle');
    this.hintText.setText(`Commanded ${amount} troop(s).`);
  }

  private recruitAtBarracks(x: number, y: number) {
    if (this.gold < GAME_RULES.economy.soldierCost) return this.hintText.setText('Not enough gold to recruit a Soldier.');
    this.gold -= GAME_RULES.economy.soldierCost;
    const count = this.units.filter((u) => u.owner === this.player).length;
    this.spawnUnit(this.player, x - 45 + (count % 4) * 22, y + 42, `a-u-${Date.now()}`);
    this.hintText.setText('Soldier recruited.');
    this.updateHud();
  }

  private toggleMessenger() {
    if (this.messengerPanel) {
      this.messengerPanel.destroy();
      this.messengerPanel = undefined;
      return;
    }

    this.setMode('idle');
    const panel = this.add.container(640, 360);
    const bg = this.add.rectangle(0, 0, 430, 280, 0xffffff).setStrokeStyle(4, 0x173449);
    const title = this.add.text(0, -105, '✉️  MESSENGER', { fontFamily: 'Segoe UI Emoji', fontSize: '28px', fontStyle: 'bold', color: '#173449' }).setOrigin(0.5);
    const peace = this.add.text(0, -35, '🤝  Propose Peace', { fontFamily: 'Segoe UI Emoji', fontSize: '22px', color: '#173449', backgroundColor: '#d9f5df', padding: { x: 15, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const surrender = this.add.text(0, 30, '🏳️  Surrender', { fontFamily: 'Segoe UI Emoji', fontSize: '22px', color: '#5d2323', backgroundColor: '#ffe0e0', padding: { x: 15, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const close = this.add.text(0, 95, 'Close', { fontSize: '18px', color: '#ffffff', backgroundColor: '#173449', padding: { x: 20, y: 8 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    peace.on('pointerdown', () => this.hintText.setText('Peace proposal queued for online multiplayer.'));
    surrender.on('pointerdown', () => this.endGame('You surrendered.'));
    close.on('pointerdown', () => {
      panel.destroy();
      this.messengerPanel = undefined;
    });

    panel.add([bg, title, peace, surrender, close]);
    this.messengerPanel = panel;
  }

  private setMode(mode: Mode) {
    this.mode = mode;
    this.modeText.setText(`MODE: ${mode.toUpperCase()}`);
  }

  private collectIncome() {
    const villages = this.countBuildings(this.player, BuildingType.Village);
    this.gold += villages * GAME_RULES.economy.villageIncome;
    this.updateHud();
  }

  private updateUnits(delta: number) {
    const enemyCastle = this.buildings.find((b) => b.owner !== this.player && b.type === BuildingType.Castle && b.hp > 0);
    for (const unit of this.units) {
      if (unit.hp <= 0 || !unit.target) continue;
      const distance = Phaser.Math.Distance.Between(unit.x, unit.y, unit.target.x, unit.target.y);
      const step = (GAME_RULES.combat.soldierSpeed * delta) / 1000;
      if (distance <= 2) unit.target = null;
      else {
        const angle = Phaser.Math.Angle.Between(unit.x, unit.y, unit.target.x, unit.target.y);
        unit.x += Math.cos(angle) * Math.min(step, distance);
        unit.y += Math.sin(angle) * Math.min(step, distance);
        unit.visual.setPosition(unit.x, unit.y);
      }

      if (enemyCastle && Phaser.Math.Distance.Between(unit.x, unit.y, enemyCastle.x, enemyCastle.y) < 50) {
        enemyCastle.hp -= (GAME_RULES.combat.soldierAttack * delta) / 1000;
        if (enemyCastle.hp <= 0) this.endGame('Victory! Enemy castle destroyed.');
      }
    }
  }

  private isInPlayerTerritory(x: number, y: number) {
    const inArena = x >= ARENA.x && x <= ARENA.x + ARENA.width && y >= ARENA.y && y <= ARENA.y + ARENA.height;
    return inArena && (this.player === 'playerA' ? y < GAME_RULES.map.midlineY : y > GAME_RULES.map.midlineY);
  }

  private countBuildings(owner: PlayerId, type: BuildingType) {
    return this.buildings.filter((b) => b.owner === owner && b.type === type && b.hp > 0).length;
  }

  private updateHud() {
    if (this.goldText) this.goldText.setText(`💰 ${this.gold}`);
  }

  private endGame(message: string) {
    this.gameOver = true;
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.55);
    this.add.text(640, 310, message, { fontSize: '42px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#173449', padding: { x: 24, y: 18 } }).setOrigin(0.5);
    this.add.text(640, 385, 'Prototype match complete • refresh to restart', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
  }
}
