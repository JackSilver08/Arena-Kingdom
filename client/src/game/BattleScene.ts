import Phaser from "phaser";
import {
  BUILDING_STATS,
  FORMATION_STATS,
  GAME_RULES,
  UNIT_STATS,
  distanceToBuilding,
  fenceAngle,
  formationOffsets,
  territoryOutline,
  type BuildingType,
  type BuildingView,
  type GameEvent,
  type MatchView,
  type Side,
  type UnitView,
} from "@arena-kingdom/shared";
import type { GameController } from "./GameController";
import { DisplaySettingsPanel } from "./displaySettingsPanel";
import { createBattleRecap } from "./battleRecap";
import { FrontlineOverlay } from "./frontlineOverlay";
import type { MapViewSize } from "./mapArt";
import { BATTLE_DEPTH, BattleVisualRenderer, battleView } from "./visuals";
import { counterOutline, pointInsideCounter } from "./atlasInteraction";
import {
  clampCamera,
  zoomAt,
  type CameraState,
  type Point,
} from "./cameraMath";
import { FogOfWar } from "./fogOfWar";
import { BattleMinimap } from "./battleMinimap";
import {
  presentationBudget,
  type PresentationQuality,
} from "./presentationVisibility";
import { TouchCameraGuard } from "./touchCameraGuard";
import { defaultBattleCamera, battleResolution } from "./battleLayout";
import { ShorelineWavesOverlay } from "./shorelineWaves";
import { LivingForestOverlay } from "./livingForest";
import { WeatherOverlay } from "./weatherOverlay";

const { width: W, height: H } = GAME_RULES.map;
const UI_FONT = '"Segoe UI", Arial, system-ui, sans-serif';
const SIDE_COLOR: Record<Side, number> = { blue: 0x3b82f6, red: 0xef4444 };
/** Dark ink drawn under yellow highlights so they stay readable on the pale paper map. */
const INK = 0x2b1d0e;
const UNIT_RADIUS = UNIT_STATS.soldier.radius;
const DRAG_THRESHOLD = 6;
/** Window resizes arrive in bursts; the map is only redrawn once they settle. */
const RESIZE_SETTLE_MS = 200;
const DEPTH = BATTLE_DEPTH;

interface UnitSprite {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  bob: number;
  seen: number;
  lastHp: number;
  hurtUntil: number;
  attackUntil: number;
  wasAttacking: boolean;
}

interface BuildingSprite {
  image: Phaser.GameObjects.Image;
  queue: Phaser.GameObjects.Text | null;
  seen: number;
  lastHp: number;
  hurtUntil: number;
}

export class BattleScene extends Phaser.Scene {
  private controller!: GameController;
  private visuals!: BattleVisualRenderer;
  private frontline!: FrontlineOverlay;
  private displaySettings: DisplaySettingsPanel | null = null;
  private recap!: ReturnType<typeof createBattleRecap>;
  private replayView: MatchView | null = null;
  private overlaysEnabled = true;
  private formationsEnabled = false;
  private reducedMotion = false;
  private res = 1;
  private effectResolution = 1;
  private smoothing = false;
  private units = new Map<number, UnitSprite>();
  private buildings = new Map<number, BuildingSprite>();
  private ground!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private fogMemory!: Phaser.GameObjects.Graphics;
  private fog!: FogOfWar;
  private minimap: BattleMinimap | null = null;
  private quality: PresentationQuality = "medium";
  private natureEnabled = true;
  private weatherEnabled = false;
  private natureElapsed = 0;
  private weatherElapsed = 0;
  private cameraMode = false;
  private portraitView = false;
  private panStart: {
    pointerId: number;
    point: Point;
    camera: CameraState;
  } | null = null;
  private touches = new Map<number, Point>();
  private pinch: { center: Point; distance: number } | null = null;
  private touchGuard = new TouchCameraGuard();
  private touchPending: {
    id: number;
    point: Point;
    mode: GameController["mode"];
  } | null = null;
  private onPointerLeave = () => this.controller.setHover(null);
  private ghost!: Phaser.GameObjects.Image;
  private lastKnown = new Map<
    number,
    {
      side: Side;
      type: UnitView["type"] | BuildingType;
      kind: "unit" | "building";
      x: number;
      y: number;
      seenAt: number;
    }
  >();
  private readonly fogMemoryMs = 12_000;
  private frameNo = 0;
  private firstSync = true;
  private dragStart: { x: number; y: number } | null = null;
  private pointerWorld = { x: 0, y: 0 };
  private effects = 0;
  private effectPool: Phaser.GameObjects.Image[] = [];
  private activeEffects = new Set<Phaser.GameObjects.GameObject>();
  private effectMotionTweens = new Set<Phaser.Tweens.Tween>();
  private view!: MapViewSize;
  private resizeTimer: Phaser.Time.TimerEvent | null = null;
  private waves!: ShorelineWavesOverlay;
  private forest!: LivingForestOverlay;
  private weather!: WeatherOverlay;
  private weatherBadge!: Phaser.GameObjects.Text;
  private weatherBadgeBg!: Phaser.GameObjects.Graphics;
  private lastWeatherType = "";

  constructor() {
    super("battle");
  }

  init(data: {
    controller: GameController;
    resolution: number;
    view: MapViewSize;
  }) {
    this.controller = data.controller;
    this.res = data.resolution;
    this.effectResolution = Math.max(1, Math.min(2, data.resolution));
    this.smoothing = data.controller.session.mode === "pvp";
    this.view = data.view;
    this.visuals = new BattleVisualRenderer(this, this.res, data.view);
  }

  preload() {
    this.visuals.preload();
  }

  create() {
    const camera = this.cameras.main;
    camera.setZoom(this.res);
    camera.centerOn(W / 2, H / 2);

    this.makeEffectTextures();
    this.drawWorld();
    this.frontline = new FrontlineOverlay(this);
    this.waves = new ShorelineWavesOverlay(this);
    this.forest = new LivingForestOverlay(this);
    this.weather = new WeatherOverlay(this);

    this.weatherBadgeBg = this.add.graphics().setDepth(DEPTH.effects + 100);
    this.weatherBadge = this.add
      .text(W / 2, 68, "", {
        fontFamily: "Georgia, serif",
        fontSize: "11px",
        fontStyle: "italic",
        color: "#29323a",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.effects + 101);

    this.ground = this.add.graphics().setDepth(DEPTH.ground);
    this.bars = this.add.graphics().setDepth(DEPTH.bars);
    this.overlay = this.add.graphics().setDepth(DEPTH.overlay);
    this.fog = new FogOfWar(this, this.controller.mySide, DEPTH.effects + 30);
    this.fogMemory = this.add.graphics().setDepth(DEPTH.effects + 31);
    this.ghost = this.add
      .image(0, 0, this.visuals.building("village", this.controller.mySide).key)
      .setDepth(DEPTH.overlay)
      .setVisible(false);

    const battleRoot = this.sys.game.canvas.closest(
      ".battle",
    ) as HTMLElement | null;
    if (battleRoot) {
      this.displaySettings = new DisplaySettingsPanel(
        battleRoot,
        (settings) => {
          this.overlaysEnabled = settings.overlays;
          this.formationsEnabled = settings.formations;
          this.reducedMotion = settings.reducedMotion;
          this.quality = settings.quality;
          this.natureEnabled = settings.nature;
          this.weatherEnabled = settings.weather;
          this.fog.setQuality(settings.quality);
          this.fog.setMapStyle(settings.mapStyle);
          this.waves.setEnabled(settings.nature && settings.mapStyle !== 'atlas');
          // MOBA terrain owns its tree silhouettes; the legacy forest would obscure ridges/units.
          this.forest.setEnabled(
            settings.nature && (settings.mapStyle === "documentary" || settings.mapStyle === "vintage"),
          );
          this.weather.setEnabled(settings.weather);
          this.weather.setQuality(settings.quality);
          this.refreshEntityArt();
          if (
            settings.reducedMotion ||
            this.effects > presentationBudget(settings.quality).effects
          )
            this.clearEffects();
          if (settings.reducedMotion) {
            for (const [id, sprite] of this.units) {
              this.tweens.killTweensOf(sprite.image);
              const unit = this.controller.view?.units.find((u) => u.id === id);
              if (unit) {
                const visual = this.visuals.unit(unit.type, unit.side);
                sprite.image
                  .setDisplaySize(visual.width, visual.height)
                  .setAlpha(1)
                  .setRotation(0);
              }
            }
            for (const [id, sprite] of this.buildings) {
              this.tweens.killTweensOf(sprite.image);
              const building = this.controller.view?.buildings.find(
                (b) => b.id === id,
              );
              if (building) {
                const visual = this.visuals.building(
                  building.type,
                  building.side,
                );
                sprite.image
                  .setDisplaySize(visual.width, visual.height)
                  .setAlpha(1);
              }
            }
            this.cameras.main.shakeEffect.reset();
          }
          this.natureElapsed = this.weatherElapsed = 1000;
          if (!settings.weather) {
            this.weatherBadge.setVisible(false);
            this.weatherBadgeBg.setVisible(false);
          } else {
            this.lastWeatherType = "";
            this.updateWeatherBadge();
          }
        },
      );
      this.recap = createBattleRecap(this, battleRoot, this.controller);
      let minimapHost = battleRoot.querySelector<HTMLElement>("[data-minimap]");
      if (!minimapHost) {
        minimapHost = document.createElement("div");
        minimapHost.dataset.minimap = "";
        minimapHost.style.cssText =
          "position:absolute;bottom:12px;right:12px;width:min(180px,28vw);z-index:8;";
        battleRoot.append(minimapHost);
      }
      this.minimap = new BattleMinimap(
        minimapHost,
        this.controller.mySide,
        (x, y) => this.focusCamera(x, y),
      );
    }

    this.bindInput();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.queueFitView, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.queueFitView, this);
      this.displaySettings?.destroy();
      this.displaySettings = null;
      this.recap?.destroy();
      this.frontline?.destroy();
      this.waves?.destroy();
      this.forest?.destroy();
      this.weather?.destroy();
      this.weatherBadge?.destroy();
      this.weatherBadgeBg?.destroy();
      this.minimap?.destroy();
      this.fog?.destroy();
      this.sys.game.canvas.removeEventListener(
        "pointerleave",
        this.onPointerLeave,
      );
      this.resizeTimer?.remove();
    });
    // The stage may have changed shape while the textures were loading.
    this.fitView();
    this.portraitView = this.isPortrait();
    this.applyCamera(defaultBattleCamera(this.view, this.res, this.portraitView, this.controller.mySide));
  }

  update(_time: number, delta: number) {
    const events = this.controller.tick(delta);
    const liveView = this.controller.view;
    if (liveView && !this.replayView) {
      this.recap?.record(liveView, events);
    }
    const view = this.replayView ?? liveView;
    if (view) {
      this.sync(view, delta);
      this.drawFog(view);
      this.frontline.update(
        view,
        delta,
        this.overlaysEnabled,
        this.reducedMotion,
      );
    }

    const matchElapsed = view?.timeMs ?? _time;
    const budget = presentationBudget(this.quality);
    this.natureElapsed += delta;
    this.weatherElapsed += delta;
    if (this.natureEnabled && this.natureElapsed >= budget.natureMs) {
      this.waves.update(this.natureElapsed, this.reducedMotion);
      const weatherMod = this.weather.modifiers;
      this.forest.setWind(
        this.weatherEnabled ? weatherMod.windAngle : 0,
        this.weatherEnabled ? weatherMod.windStrength : 0.4,
      );
      this.forest.update(this.natureElapsed, this.reducedMotion);
      this.natureElapsed = 0;
    }
    if (this.weatherEnabled && this.weatherElapsed >= budget.weatherMs) {
      this.weather.update(
        matchElapsed,
        this.weatherElapsed,
        this.reducedMotion,
      );
      this.weatherElapsed = 0;
    }
    this.updateWeatherBadge();

    if (!this.replayView) this.playEvents(events);
    this.drawOverlay(view);
  }

  private updateWeatherBadge() {
    if (!this.weatherEnabled) {
      this.weatherBadge.setVisible(false);
      this.weatherBadgeBg.setVisible(false);
      return;
    }
    const current = this.weather.weather;
    if (current === this.lastWeatherType) return;
    this.lastWeatherType = current;

    const cfg = this.weather.modifiers;
    this.weatherBadge.setText(`${cfg.icon} ${cfg.label} · ${cfg.description}`);
    this.weatherBadge.setVisible(true);
    this.weatherBadgeBg.setVisible(true);

    const bounds = this.weatherBadge.getBounds();
    this.weatherBadgeBg.clear();
    this.weatherBadgeBg.fillStyle(0xeee6d2, 0.92);
    this.weatherBadgeBg.lineStyle(1.2, 0x506a70, 0.7);
    this.weatherBadgeBg.fillRoundedRect(
      bounds.x - 12,
      bounds.y - 4,
      bounds.width + 24,
      bounds.height + 8,
      4,
    );
    this.weatherBadgeBg.strokeRoundedRect(
      bounds.x - 12,
      bounds.y - 4,
      bounds.width + 24,
      bounds.height + 8,
      4,
    );
  }

  /** Switch the renderer between the live match state and a recorded recap frame. */
  setReplayView(view: MatchView | null) {
    // Seeking to an earlier frame must not retain knowledge from live or a later recap frame.
    if (!view || !this.replayView || view.timeMs < this.replayView.timeMs) {
      this.lastKnown.clear();
      this.fog.reset();
    }
    this.dragStart = null;
    this.touchPending = null;
    this.clearEffects();
    this.replayView = view;
    this.controller.setReplayHud(view);
    if (view) {
      this.sync(view, 1);
      this.drawFog(view, true);
      this.frontline.update(view, 0, this.overlaysEnabled, true);
    }
  }

  // ---------------------------------------------------------------- setup

  private makeEffectTextures() {
    const r = this.effectResolution;
    const make = (
      key: string,
      size: number,
      draw: (g: Phaser.GameObjects.Graphics, c: number) => void,
    ) => {
      if (this.textures.exists(key)) this.textures.remove(key);
      const g = this.make.graphics({}, false);
      draw(g, (size * r) / 2);
      g.generateTexture(key, size * r, size * r);
      g.destroy();
    };
    make("spark", 16, (g, c) => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(c, c, 3 * r);
      g.fillStyle(0xfff3a1, 0.7);
      g.fillCircle(c, c, 6 * r);
    });
    make("ring", 64, (g, c) => {
      g.lineStyle(3 * r, 0xffffff, 1);
      g.strokeCircle(c, c, 28 * r);
    });
    make("arrow", 24, (g, c) => {
      g.lineStyle(2 * r, 0x3f2a14, 1);
      g.lineBetween(c - 9 * r, c, c + 7 * r, c);
      g.fillStyle(0x3f2a14, 1);
      g.fillTriangle(c + 10 * r, c, c + 5 * r, c - 3 * r, c + 5 * r, c + 3 * r);
    });
  }

  private drawWorld() {
    this.visuals.drawTerrain();
  }

  private queueFitView() {
    this.resizeTimer?.remove();
    this.resizeTimer = this.time.delayedCall(RESIZE_SETTLE_MS, () =>
      this.fitView(),
    );
  }

  /** Keeps the map filling the stage when it changes shape, e.g. after a window resize or entering full screen. */
  private isPortrait() {
    return this.scale.parentSize.width < 768 && this.scale.parentSize.height > this.scale.parentSize.width;
  }

  private fitView() {
    const view = battleView(
      this.scale.parentSize.width,
      this.scale.parentSize.height,
    );
    const resolution = battleResolution(this.scale.parentSize, view, window.devicePixelRatio);
    if (view.width === this.view.width && view.height === this.view.height && resolution === this.res)
      return;
    const portrait = this.isPortrait();
    const camera = portrait && !this.portraitView
      ? defaultBattleCamera(view, resolution, true, this.controller.mySide)
      : { ...this.cameraState(), zoom: this.cameraState().zoom / this.res * resolution };
    this.portraitView = portrait;
    this.res = resolution;
    this.view = view;
    this.scale.setGameSize(
      Math.round(view.width * this.res),
      Math.round(view.height * this.res),
    );
    this.applyCamera(camera);
    this.dragStart = null;
    this.panStart = null;
    this.touchPending = null;
    this.visuals.resizeTerrain(view);
  }

  private cameraState(): CameraState {
    const camera = this.cameras.main;
    return {
      x: camera.scrollX + camera.width / 2,
      y: camera.scrollY + camera.height / 2,
      zoom: camera.zoom,
    };
  }

  private cameraViewport() {
    return { width: this.cameras.main.width, height: this.cameras.main.height };
  }

  private applyCamera(state: CameraState) {
    const next = clampCamera(state, this.cameraViewport(), GAME_RULES.map);
    this.cameras.main.setZoom(next.zoom).centerOn(next.x, next.y);
    // Update inverse transform immediately: placement/hover must not use the previous frame matrix.
    this.cameras.main.preRender();
    this.pointerWorld = this.worldPoint(this.input.activePointer);
    if (this.controller.view)
      this.updateMinimap(this.replayView ?? this.controller.view);
  }

  /** HUD zoom factor; wheel uses its pointer as anchor. */
  zoomCamera(factor: number, anchor?: Point) {
    const viewport = this.cameraViewport();
    this.dragStart = null;
    this.applyCamera(
      zoomAt(
        this.cameraState(),
        factor,
        anchor ?? { x: viewport.width / 2, y: viewport.height / 2 },
        viewport,
        GAME_RULES.map,
        { min: this.res, max: this.res * 3 },
      ),
    );
  }

  resetCamera() {
    this.dragStart = null;
    this.panStart = null;
    this.applyCamera({ x: W / 2, y: H / 2, zoom: this.res });
  }

  focusCamera(x: number, y: number) {
    this.dragStart = null;
    this.touchPending = null;
    this.applyCamera({ ...this.cameraState(), x, y });
  }

  setCameraMode(enabled: boolean) {
    this.cameraMode = enabled;
    this.dragStart = null;
    this.touchPending = null;
    this.panStart = null;
    this.controller.setHover(
      enabled
        ? "Camera mode · drag to pan · pinch to zoom · switch off to command."
        : null,
    );
  }

  closeDisplaySettings() {
    if (this.displaySettings?.isOpen()) this.displaySettings.close();
  }

  private updateMinimap(view: MatchView) {
    this.minimap?.update(
      view,
      this.cameraState(),
      this.cameraViewport(),
      this.fog.canvas,
    );
  }

  // ---------------------------------------------------------------- input

  private worldPoint(pointer: Phaser.Input.Pointer) {
    const point = pointer.positionToCamera(
      this.cameras.main,
    ) as Phaser.Math.Vector2;
    return { x: point.x, y: point.y };
  }

  private bindInput() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.displaySettings?.isOpen()) return;
      const { x, y } = this.worldPoint(pointer);
      const shift = (pointer.event as MouseEvent).shiftKey;
      const c = this.controller;
      if (pointer.wasTouch) {
        this.touchGuard.start(
          pointer.id,
          this.cameraMode || Boolean(this.replayView),
        );
        this.touches.set(pointer.id, { x: pointer.x, y: pointer.y });
        if (this.touches.size >= 2) {
          this.touchPending = null;
          this.dragStart = null;
          this.panStart = null;
          this.pinch = this.pinchState();
          return;
        }
        if (this.cameraMode || this.replayView) {
          this.panStart = {
            pointerId: pointer.id,
            point: { x: pointer.x, y: pointer.y },
            camera: this.cameraState(),
          };
        } else {
          // Defer touch commands until release so the second finger can cancel them safely.
          this.touchPending = { id: pointer.id, point: { x, y }, mode: c.mode };
          if (c.mode === "idle") this.dragStart = { x, y };
        }
        return;
      }
      if (pointer.button === 1 || (pointer.button === 0 && this.cameraMode)) {
        this.dragStart = null;
        this.panStart = {
          pointerId: pointer.id,
          point: { x: pointer.x, y: pointer.y },
          camera: this.cameraState(),
        };
        return;
      }
      if (this.replayView) return;
      if (pointer.button === 2) {
        c.rightClick(x, y, shift, this.enemyAt(x, y));
        return;
      }
      if (pointer.button !== 0) return;
      if (c.mode === "build") c.placeBuilding(x, y, shift);
      else if (c.mode === "troops") c.commandArmy(x, y, this.enemyAt(x, y));
      else this.dragStart = { x, y };
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch && this.touches.has(pointer.id)) {
        this.touches.set(pointer.id, { x: pointer.x, y: pointer.y });
        if (this.touches.size >= 2) {
          const next = this.pinchState();
          const previous = this.pinch;
          if (next && previous) {
            this.zoomCamera(
              next.distance / Math.max(1, previous.distance),
              previous.center,
            );
            const state = this.cameraState();
            this.applyCamera({
              ...state,
              x: state.x + (previous.center.x - next.center.x) / state.zoom,
              y: state.y + (previous.center.y - next.center.y) / state.zoom,
            });
          }
          this.pinch = next;
          return;
        }
      }
      if (this.panStart?.pointerId === pointer.id) {
        const start = this.panStart;
        this.applyCamera({
          ...start.camera,
          x: start.camera.x + (start.point.x - pointer.x) / start.camera.zoom,
          y: start.camera.y + (start.point.y - pointer.y) / start.camera.zoom,
        });
        return;
      }
      this.pointerWorld = this.worldPoint(pointer);
      this.updateHover();
    });

    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _over: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        const c = this.controller;
        if (this.displaySettings?.isOpen()) return;
        if (
          !this.replayView &&
          c.canCommand &&
          c.mode === "build" &&
          c.buildType === "fence"
        )
          c.rotateFence(deltaY < 0 ? -1 : 1);
        else
          this.zoomCamera(
            Math.exp(-Phaser.Math.Clamp(deltaY, -200, 200) * 0.0015),
            { x: pointer.x, y: pointer.y },
          );
        (pointer.event as WheelEvent).preventDefault?.();
      },
    );

    const finishDrag = (pointer: Phaser.Input.Pointer) => {
      const start = this.dragStart;
      this.dragStart = null;
      if (this.panStart?.pointerId === pointer.id) this.panStart = null;
      if (pointer.wasTouch) {
        this.touches.delete(pointer.id);
        this.pinch = null;
        const pending = this.touchPending;
        this.touchPending = null;
        const cancelled =
          this.touchGuard.release(pointer.id) ||
          pointer.event.type === "touchcancel" ||
          this.replayView ||
          this.displaySettings?.isOpen();
        if (
          cancelled ||
          !pending ||
          pending.id !== pointer.id ||
          pending.mode !== this.controller.mode
        )
          return;
        const end = this.worldPoint(pointer);
        // A dragged placement/army tap never submits an accidental command.
        const dx = Math.abs(end.x - pending.point.x),
          dy = Math.abs(end.y - pending.point.y);
        if (
          pending.mode !== "idle" &&
          (dx > this.selectionThreshold() || dy > this.selectionThreshold())
        )
          return;
        if (pending.mode === "build")
          this.controller.placeBuilding(end.x, end.y, false);
        else if (pending.mode === "troops")
          this.controller.commandArmy(end.x, end.y, this.enemyAt(end.x, end.y));
        else if (start) this.handleSelection(start, end, false);
        return;
      }
      if (this.cameraMode || this.replayView || this.displaySettings?.isOpen())
        return;
      if (!start || pointer.button !== 0) return;
      const shift = (pointer.event as MouseEvent).shiftKey;
      this.handleSelection(start, this.worldPoint(pointer), shift);
    };
    this.input.on("pointerup", finishDrag);
    this.input.on("pointerupoutside", finishDrag);
    this.input.on("gameout", () => {
      this.dragStart = null;
      this.panStart = null;
      this.touchPending = null;
      this.touches.clear();
      this.pinch = null;
      this.touchGuard.cancel();
    });
    this.sys.game.canvas.addEventListener("pointerleave", this.onPointerLeave);
  }

  private pinchState() {
    const points = [...this.touches.values()];
    if (points.length < 2) return null;
    return {
      center: {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      },
      distance: Math.hypot(
        points[0].x - points[1].x,
        points[0].y - points[1].y,
      ),
    };
  }

  private selectionThreshold() {
    const cssScale =
      this.sys.game.canvas.getBoundingClientRect().width / this.scale.width;
    return DRAG_THRESHOLD / Math.max(0.001, this.cameras.main.zoom * cssScale);
  }

  /** Id of the enemy unit or building under a point, for targeted attacks. */
  private enemyAt(x: number, y: number) {
    const view = this.controller.view;
    if (!view) return undefined;
    const enemy = view.units.filter((u) => u.side !== this.controller.mySide);
    const unit = this.unitAt(enemy, x, y);
    if (unit) return unit.id;
    const building = this.buildingAt(view.buildings, x, y);
    return building && building.side !== this.controller.mySide
      ? building.id
      : undefined;
  }

  private handleSelection(
    start: { x: number; y: number },
    end: { x: number; y: number },
    additive: boolean,
  ) {
    const c = this.controller;
    const view = c.view;
    if (!view) return;
    const mine = view.units.filter(
      (u) => u.side === c.mySide && u.type !== "royal_guard",
    );

    if (
      Math.abs(end.x - start.x) > this.selectionThreshold() ||
      Math.abs(end.y - start.y) > this.selectionThreshold()
    ) {
      const minX = Math.min(start.x, end.x) - UNIT_RADIUS;
      const maxX = Math.max(start.x, end.x) + UNIT_RADIUS;
      const minY = Math.min(start.y, end.y) - UNIT_RADIUS;
      const maxY = Math.max(start.y, end.y) + UNIT_RADIUS;
      c.selectUnits(
        mine
          .filter(
            (u) => u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY,
          )
          .map((u) => u.id),
        additive,
      );
      return;
    }

    const unit = this.unitAt(mine, end.x, end.y);
    if (unit) {
      if (additive) c.toggleUnit(unit.id);
      else c.selectUnits([unit.id], false);
      return;
    }
    const building = this.buildingAt(view.buildings, end.x, end.y);
    if (building && building.side === c.mySide) {
      if (building.type === "barracks") c.openBarracks(building.id);
      else if (building.type === "castle") c.openCastle(building.id);
      return;
    }
    if (!additive) c.clearSelection();
  }

  private unitAt(units: UnitView[], x: number, y: number) {
    let best: UnitView | null = null;
    const atlas = this.visuals.isAtlas;
    let bestDist = atlas ? Infinity : UNIT_RADIUS + 10;
    for (const u of units) {
      // The tactical counter's clickable area matches its rectangular art,
      // without changing the engine's collision radius or command semantics.
      if (atlas && !pointInsideCounter(
        { x, y }, { x: u.x, y: u.y }, this.visuals.unit(u.type, u.side)
      )) continue;
      const d = atlas
        ? Math.hypot(u.x - x, u.y - y)
        : Math.min(
            Math.hypot(u.x - x, u.y - y),
            Math.hypot(u.x - x, u.y - 12 - y),
          );
      if (d <= bestDist) {
        best = u;
        bestDist = d;
      }
    }
    return best;
  }

  private buildingAt(buildings: BuildingView[], x: number, y: number) {
    let best: BuildingView | null = null;
    let bestGap = 8;
    for (const b of buildings) {
      const gap = Math.min(
        distanceToBuilding(b, x, y),
        distanceToBuilding(b, x, y + BUILDING_STATS[b.type].halfHeight * 0.6),
      );
      if (gap <= bestGap) {
        best = b;
        bestGap = gap;
      }
    }
    return best;
  }

  private updateHover() {
    const c = this.controller;
    const view = this.replayView ?? c.view;
    if (!view || (!this.replayView && c.mode === "build")) {
      c.setHover(null);
      return;
    }
    const { x, y } = this.pointerWorld;
    const unit = this.unitAt(view.units, x, y);
    if (unit) {
      const owner = unit.side === c.mySide ? "Your" : "Enemy";
      c.setHover(
        `${owner} troop · ${Math.ceil(unit.hp)} / ${unit.maxHp} HP${unit.side !== c.mySide ? " · right-click to attack" : ""}`,
      );
      return;
    }
    const building = this.buildingAt(view.buildings, x, y);
    if (building) {
      const stats = BUILDING_STATS[building.type];
      const mine = building.side === c.mySide;
      let text = `${mine ? "Your" : "Enemy"} ${stats.label} · ${Math.ceil(building.hp)} / ${building.maxHp} HP`;
      if (building.type === "barracks" && mine)
        text += ` · ${building.queue} in training · click to recruit (${UNIT_STATS.soldier.cost}$)`;
      else if (!mine) text += " · right-click to attack";
      c.setHover(text);
      return;
    }
    c.setHover(null);
  }

  // ---------------------------------------------------------------- sync

  /** Skin switches replace live textures, not unit/building simulation objects. */
  private refreshEntityArt() {
    const view = this.replayView ?? this.controller.view;
    if (!view) return;
    const units = new Map(view.units.map(u => [u.id, u]));
    for (const [id, sprite] of this.units) {
      const unit = units.get(id);
      if (!unit) continue;
      const art = this.visuals.unit(unit.type, unit.side);
      this.tweens.killTweensOf(sprite.image);
      sprite.image.setTexture(art.key).setOrigin(.5, art.anchorY)
        .setDisplaySize(art.width, art.height).setAlpha(1).setRotation(0);
    }
    const buildings = new Map(view.buildings.map(b => [b.id, b]));
    for (const [id, sprite] of this.buildings) {
      const building = buildings.get(id);
      if (!building) continue;
      const art = this.visuals.building(building.type, building.side);
      this.tweens.killTweensOf(sprite.image);
      sprite.image.setTexture(art.key).setOrigin(.5, art.anchorY)
        .setDisplaySize(art.width, art.height).setAlpha(1);
      sprite.queue?.setPosition(building.x + art.width / 2 - 4,
        building.y - art.height * art.anchorY);
    }
  }

  private sync(view: MatchView, delta: number) {
    const frame = ++this.frameNo;
    const smooth =
      this.smoothing && !this.replayView ? Math.min(1, delta / 90) : 1;

    const now = this.time.now;
    for (const u of view.units) {
      if (u.side === this.controller.mySide) continue;
      this.lastKnown.set(u.id, {
        side: u.side,
        type: u.type,
        kind: "unit",
        x: u.x,
        y: u.y,
        seenAt: now,
      });
    }
    for (const b of view.buildings) {
      if (b.side === this.controller.mySide) continue;
      this.lastKnown.set(b.id, {
        side: b.side,
        type: b.type,
        kind: "building",
        x: b.x,
        y: b.y,
        seenAt: now,
      });
    }

    for (const u of view.units) {
      let sprite = this.units.get(u.id);
      if (!sprite) {
        const visual = this.visuals.unit(u.type, u.side);
        const image = this.add
          .image(u.x, u.y, visual.key)
          .setOrigin(0.5, visual.anchorY)
          .setDisplaySize(visual.width, visual.height);
        sprite = {
          image,
          x: u.x,
          y: u.y,
          bob: u.id % 6,
          seen: frame,
          lastHp: u.hp,
          hurtUntil: 0,
          attackUntil: 0,
          wasAttacking: false,
        };
        this.units.set(u.id, sprite);
        if (!this.firstSync && !this.reducedMotion && !this.replayView) {
          const scaleX = image.scaleX,
            scaleY = image.scaleY;
          image.setScale(scaleX * 0.7, scaleY * 0.7).setAlpha(0.4);
          this.tweens.add({
            targets: image,
            scaleX,
            scaleY,
            alpha: 1,
            duration: 170,
            ease: "Sine.easeOut",
          });
        }
      }
      sprite.seen = frame;
      sprite.x += (u.x - sprite.x) * smooth;
      sprite.y += (u.y - sprite.y) * smooth;
      if (u.hp < sprite.lastHp) sprite.hurtUntil = this.time.now + 110;
      if (
        u.attacking &&
        (!sprite.wasAttacking ||
          this.time.now >
            sprite.attackUntil + UNIT_STATS[u.type].attack.cooldownMs)
      )
        sprite.attackUntil = this.time.now + 100;
      sprite.wasAttacking = u.attacking;
      sprite.lastHp = u.hp;
      // A military counter slides on the map; it never walks or bounces.
      if (u.moving && !this.reducedMotion && !this.visuals.isAtlas) sprite.bob += delta * 0.016;
      const bobY =
        u.moving && !this.reducedMotion && !this.visuals.isAtlas && this.quality !== "low"
          ? -Math.abs(Math.sin(sprite.bob)) * 1.5
          : 0;
      const recoiling =
        !this.reducedMotion &&
        u.type === "cannon" && !this.visuals.isAtlas &&
        this.time.now < sprite.attackUntil;
      sprite.image.setPosition(
        sprite.x + (recoiling ? (u.side === "blue" ? -1.5 : 1.5) : 0),
        sprite.y + bobY,
      );
      sprite.image.setDepth(DEPTH.entities + sprite.y / 10);
      if (this.time.now < sprite.hurtUntil) sprite.image.setTint(0xffc1b9);
      else if (this.time.now < sprite.attackUntil)
        sprite.image.setTint(0xffefc6);
      else sprite.image.clearTint();
      sprite.image.setRotation(
        !this.visuals.isAtlas && !this.reducedMotion && this.quality !== "low" && u.attacking
          ? Math.sin(this.time.now * 0.018) * 0.04
          : 0,
      );
    }
    for (const [id, sprite] of this.units) {
      if (sprite.seen !== frame) {
        sprite.image.destroy();
        this.units.delete(id);
      }
    }

    for (const b of view.buildings) {
      let sprite = this.buildings.get(b.id);
      if (!sprite) {
        sprite = this.createBuilding(b);
        this.buildings.set(b.id, sprite);
      }
      sprite.seen = frame;
      sprite.image.setRotation(b.type === "fence" ? fenceAngle(b.rotation) : 0);
      if (b.hp < sprite.lastHp) sprite.hurtUntil = this.time.now + 140;
      sprite.lastHp = b.hp;
      if (this.time.now < sprite.hurtUntil) sprite.image.setTint(0xffb4b4);
      else sprite.image.clearTint();
      if (sprite.queue)
        sprite.queue
          .setText(b.queue > 0 ? `×${b.queue}` : "")
          .setVisible(b.queue > 0);
    }
    for (const [id, sprite] of this.buildings) {
      if (sprite.seen !== frame) {
        sprite.image.destroy();
        sprite.queue?.destroy();
        this.buildings.delete(id);
      }
    }

    this.drawBars(view);
    this.firstSync = false;
  }

  private createBuilding(b: BuildingView): BuildingSprite {
    const visual = this.visuals.building(b.type, b.side);
    const image = this.add
      .image(b.x, b.y, visual.key)
      .setOrigin(0.5, visual.anchorY)
      .setDisplaySize(visual.width, visual.height)
      .setRotation(b.type === "fence" ? fenceAngle(b.rotation) : 0)
      .setDepth(DEPTH.entities + b.y / 10);
    const queue =
      b.type === "barracks"
        ? this.add
            .text(
              b.x + visual.width / 2 - 4,
              b.y - visual.height * visual.anchorY,
              "",
              {
                fontFamily: UI_FONT,
                fontSize: "15px",
                fontStyle: "bold",
                color: "#111111",
                backgroundColor: "#ffe500",
                padding: { x: 5, y: 1 },
                resolution: Math.max(1, this.res),
              },
            )
            .setDepth(DEPTH.bars)
        : null;
    if (!this.firstSync && !this.reducedMotion && !this.replayView) {
      const scaleX = image.scaleX;
      const scaleY = image.scaleY;
      image.setScale(scaleX * 0.85, scaleY * 0.85).setAlpha(0.4);
      this.tweens.add({
        targets: image,
        scaleX,
        scaleY,
        alpha: 1,
        duration: 220,
        ease: "Sine.easeOut",
      });
    }
    return { image, queue, seen: 0, lastHp: b.hp, hurtUntil: 0 };
  }

  private drawBars(view: MatchView) {
    const g = this.bars;
    const c = this.controller;
    g.clear();
    for (const b of view.buildings) {
      const stats = BUILDING_STATS[b.type];
      const visual = this.visuals.building(b.type, b.side);
      const top = b.y - visual.height * visual.anchorY;
      if (b.hp < b.maxHp) {
        const width = Math.min(90, Math.max(44, stats.halfWidth * 1.6));
        const share = Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
        g.fillStyle(0x111111, 0.85);
        g.fillRoundedRect(b.x - width / 2 - 2, top - 12, width + 4, 9, 4);
        g.fillStyle(share < 0.3 ? 0xff9f1c : SIDE_COLOR[b.side], 1);
        g.fillRoundedRect(
          b.x - width / 2,
          top - 10,
          Math.max(3, width * share),
          5,
          2,
        );
      }
      if (b.type === "barracks" && b.queue > 0) {
        const width = visual.width - 12;
        const bottom = b.y + visual.height * (1 - visual.anchorY);
        g.fillStyle(0x111111, 0.75);
        g.fillRoundedRect(b.x - width / 2, bottom + 3, width, 6, 3);
        g.fillStyle(0xffe500, 1);
        g.fillRoundedRect(
          b.x - width / 2 + 1,
          bottom + 4,
          (width - 2) * b.trainProgress,
          4,
          2,
        );
      }
    }
    for (const u of view.units) {
      const selected =
        !this.replayView && u.side === c.mySide && c.selection.has(u.id);
      if (u.hp >= u.maxHp && !selected && !u.rearguard && !u.retreating)
        continue;
      const sprite = this.units.get(u.id);
      const ux = sprite?.x ?? u.x;
      const troop = this.visuals.unit(u.type, u.side);
      const uy = (sprite?.y ?? u.y) - troop.height * troop.anchorY - 7;
      const share = Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1);

      if (u.rearguard || u.retreating) {
        const color = SIDE_COLOR[u.side];
        if (u.rearguard) {
          // Small shield marker above the HP bar. It stays deliberately abstract and map-like.
          g.fillStyle(color, 0.95);
          g.beginPath();
          g.moveTo(ux - 4, uy - 8);
          g.lineTo(ux + 4, uy - 8);
          g.lineTo(ux + 5, uy - 3);
          g.lineTo(ux, uy + 1);
          g.lineTo(ux - 5, uy - 3);
          g.closePath();
          g.fillPath();
          g.lineStyle(1.5, 0xffffff, 0.95);
          g.strokePath();
        } else {
          // Three short retreat streaks communicate movement direction without cluttering the unit glyph.
          g.lineStyle(1.8, color, 0.85);
          g.lineBetween(ux + 13, uy - 5, ux + 20, uy - 5);
          g.lineBetween(ux + 13, uy - 1, ux + 18, uy - 1);
          g.lineBetween(ux + 13, uy + 3, ux + 20, uy + 3);
        }
      }

      g.fillStyle(0x111111, 0.85);
      g.fillRect(ux - 12, uy, 24, 5);
      g.fillStyle(share < 0.35 ? 0xff9f1c : 0x22c55e, 1);
      g.fillRect(ux - 11, uy + 1, 22 * share, 3);
    }
  }

  private drawFog(view: MatchView, force = false) {
    if (!this.fog.update(view, this.time.now, force)) return;
    this.updateMinimap(view);
    const memory = this.fogMemory;
    memory.clear();
    if (view.result) return;
    const visibleEnemy = new Set(
      view.units
        .filter((u) => u.side !== this.controller.mySide)
        .map((u) => u.id),
    );
    for (const building of view.buildings)
      if (building.side !== this.controller.mySide)
        visibleEnemy.add(building.id);
    for (const [id, marker] of this.lastKnown) {
      const age = this.time.now - marker.seenAt;
      if (age >= this.fogMemoryMs) {
        this.lastKnown.delete(id);
        continue;
      }
      if (visibleEnemy.has(id)) continue;
      const alpha = 0.42 * (1 - age / this.fogMemoryMs);
      memory.lineStyle(1.5, 0xb7c5d0, alpha);
      if (marker.kind === "building")
        memory.strokeRect(marker.x - 8, marker.y - 8, 16, 16);
      else {
        memory.strokeCircle(marker.x, marker.y, 7);
        memory.lineBetween(marker.x - 4, marker.y, marker.x + 4, marker.y);
      }
    }
  }

  // ---------------------------------------------------------------- overlay

  private formationCount(view: MatchView) {
    const army = view.units.filter((u) => u.side === this.controller.mySide);
    if (this.controller.fraction === "one-third")
      return Math.max(1, Math.ceil(army.length / 3));
    if (this.controller.fraction === "two-thirds")
      return Math.max(1, Math.ceil((army.length * 2) / 3));
    return army.length;
  }

  private drawFormationPreview(view: MatchView, x: number, y: number) {
    if (
      !this.formationsEnabled ||
      this.controller.mode !== "troops" ||
      !this.controller.canCommand ||
      !view.units.length
    )
      return;
    const count = this.formationCount(view);
    if (count <= 0) return;
    const army = view.units.filter((u) => u.side === this.controller.mySide);
    if (!army.length) return;
    const center = army.reduce(
      (sum, unit) => ({
        x: sum.x + unit.x / army.length,
        y: sum.y + unit.y / army.length,
      }),
      { x: 0, y: 0 },
    );
    const facing = Math.atan2(y - center.y, x - center.x);
    const formation = this.controller.formation;
    const offsets = formationOffsets(
      count,
      formation,
      FORMATION_STATS[formation].spacing,
      facing,
    );
    const color = SIDE_COLOR[this.controller.mySide];
    const scale = Math.min(
      1,
      Math.max(0.7, 24 / Math.max(24, Math.sqrt(count) * 24)),
    );

    for (const offset of offsets) {
      const px = x + offset.x;
      const py = y + offset.y;
      this.overlay.lineStyle(2, INK, 0.55);
      this.overlay.strokeCircle(px, py, 8 * scale);
      this.overlay.fillStyle(color, 0.38);
      this.overlay.fillCircle(px, py, 5.2 * scale);
    }

    this.overlay.lineStyle(2, color, 0.7);
    const formationRadius = Math.max(
      18,
      ...offsets.map((offset) => Math.hypot(offset.x, offset.y)),
    );
    this.overlay.strokeCircle(x, y, formationRadius + 14);
  }

  private drawOverlay(view: MatchView | null) {
    const g = this.ground;
    const o = this.overlay;
    const c = this.controller;
    g.clear();
    o.clear();
    if (!view) return;

    if (!this.replayView && c.selection.size) {
      for (const u of view.units) {
        if (!c.selection.has(u.id)) continue;
        const sprite = this.units.get(u.id);
        const x = sprite?.x ?? u.x,
          y = sprite?.y ?? u.y;
        if (this.visuals.isAtlas) {
          // A selected tactical counter uses a rectangular brass outline.
          const art = this.visuals.unit(u.type, u.side);
          const frame = counterOutline({ x, y }, art);
          g.fillStyle(0x3ca8ff, .13);
          g.fillRoundedRect(frame.x, frame.y, frame.width, frame.height, 3);
          g.lineStyle(2.5, 0xddc389, 1);
          g.strokeRoundedRect(frame.x, frame.y, frame.width, frame.height, 3);
        } else {
          g.fillStyle(0x3ca8ff, 0.14);
          g.fillEllipse(x, y + 1, 34, 16);
          g.lineStyle(4.5, 0x071722, 0.92);
          g.strokeEllipse(x, y + 1, 34, 16);
          g.lineStyle(2, 0xddc389, 1);
          g.strokeEllipse(x, y + 1, 34, 16);
          g.lineStyle(1, 0x9cdded, 0.9);
          g.strokeEllipse(x, y + 1, 27, 11);
        }
      }
    }

    const { x, y } = this.pointerWorld;
    const cursor = this.cameraMode
      ? this.panStart
        ? "grabbing"
        : "grab"
      : this.replayView
        ? "default"
        : c.mode === "idle"
          ? "default"
          : "crosshair";
    if (this.input.manager.defaultCursor !== cursor)
      this.input.setDefaultCursor(cursor);

    if (!this.replayView && c.mode === "build" && c.canCommand) {
      const territory = territoryOutline(
        c.mySide,
      ) as Phaser.Types.Math.Vector2Like[];
      o.fillStyle(SIDE_COLOR[c.mySide], 0.1);
      o.fillPoints(territory, true);
      o.lineStyle(2, SIDE_COLOR[c.mySide], 0.55);
      o.strokePoints(territory, true);

      const type = c.buildType;
      const stats = BUILDING_STATS[type];
      const visual = this.visuals.building(type, c.mySide);
      const point = c.placementPoint(x, y);
      const valid =
        c.placementCheck(point.x, point.y).ok &&
        view.players[c.mySide].gold >= stats.cost;
      const color = valid ? 0x22c55e : 0xef4444;
      o.fillStyle(color, 0.28);
      o.lineStyle(3, color, 0.95);
      if (stats.shape === "rect") {
        if (type === "fence") {
          const angle = fenceAngle(c.buildFenceRotation);
          const cos = Math.cos(angle),
            sin = Math.sin(angle);
          const corners = [
            { x: -stats.halfWidth, y: -stats.halfHeight },
            { x: stats.halfWidth, y: -stats.halfHeight },
            { x: stats.halfWidth, y: stats.halfHeight },
            { x: -stats.halfWidth, y: stats.halfHeight },
          ].map(({ x: lx, y: ly }) => ({
            x: point.x + lx * cos - ly * sin,
            y: point.y + lx * sin + ly * cos,
          }));
          o.fillPoints(corners, true);
          o.strokePoints(corners, true);
        } else {
          o.fillRect(
            point.x - stats.halfWidth,
            point.y - stats.halfHeight,
            stats.halfWidth * 2,
            stats.halfHeight * 2,
          );
          o.strokeRect(
            point.x - stats.halfWidth,
            point.y - stats.halfHeight,
            stats.halfWidth * 2,
            stats.halfHeight * 2,
          );
        }
      } else {
        o.fillEllipse(
          point.x,
          point.y,
          stats.halfWidth * 2 + 12,
          stats.halfWidth * 2 + 12,
        );
        o.strokeEllipse(
          point.x,
          point.y,
          stats.halfWidth * 2 + 12,
          stats.halfWidth * 2 + 12,
        );
      }
      if (stats.attack) {
        o.lineStyle(2, INK, 0.5);
        o.strokeCircle(
          point.x,
          point.y,
          stats.halfWidth + UNIT_RADIUS + stats.attack.range,
        );
      }
      this.ghost
        .setTexture(visual.key)
        .setOrigin(0.5, visual.anchorY)
        .setDisplaySize(visual.width, visual.height)
        .setPosition(point.x, point.y)
        .setRotation(type === "fence" ? fenceAngle(c.buildFenceRotation) : 0)
        .setAlpha(valid ? 0.8 : 0.4)
        .setVisible(true);
    } else {
      this.ghost.setVisible(false);
    }

    if (!this.replayView && c.mode === "troops" && c.canCommand) {
      for (const [width, color, alpha] of [
        [6, INK, 0.6],
        [3, 0xffe500, 1],
      ]) {
        o.lineStyle(width, color, alpha);
        o.strokeCircle(x, y, 18);
        o.lineBetween(x - 28, y, x - 10, y);
        o.lineBetween(x + 10, y, x + 28, y);
        o.lineBetween(x, y - 28, x, y - 10);
        o.lineBetween(x, y + 10, x, y + 28);
      }
      this.drawFormationPreview(view, x, y);
    }

    if (!this.replayView && this.dragStart && this.input.activePointer.isDown) {
      const start = this.dragStart;
      if (
        Math.abs(x - start.x) > this.selectionThreshold() ||
        Math.abs(y - start.y) > this.selectionThreshold()
      ) {
        const left = Math.min(start.x, x);
        const top = Math.min(start.y, y);
        const width = Math.abs(x - start.x);
        const height = Math.abs(y - start.y);
        o.fillStyle(0xffe500, 0.18);
        o.fillRect(left, top, width, height);
        o.lineStyle(5, INK, 0.55);
        o.strokeRect(left, top, width, height);
        o.lineStyle(2, 0xffe500, 1);
        o.strokeRect(left, top, width, height);
      }
    }
  }

  // ---------------------------------------------------------------- effects

  private playEvents(events: GameEvent[]) {
    for (const event of events) {
      if (this.effects >= presentationBudget(this.quality).effects) continue;
      switch (event.type) {
        case "shot":
          this.arrow(event.fromX, event.fromY, event.toX, event.toY, 0.2);
          break;
        case "arrowShot":
          this.arrow(event.fromX, event.fromY, event.toX, event.toY, 0.85);
          break;
        case "cannonShot":
          this.cannonball(
            event.fromX,
            event.fromY,
            event.toX,
            event.toY,
            event.radius,
          );
          break;
        case "hit":
          this.spark(
            event.x + Phaser.Math.Between(-5, 5),
            event.y - 8 + Phaser.Math.Between(-5, 5),
            0.55,
          );
          break;
        case "unitDied":
          this.ring(
            event.x,
            event.y - 8,
            SIDE_COLOR[event.side],
            0.2,
            0.8,
            380,
          );
          break;
        case "unitTrained":
          this.ring(event.x, event.y, 0xffe500, 0.15, 0.6, 320);
          break;
        case "buildingPlaced":
          this.ring(event.x, event.y, 0xffffff, 0.4, 1.6, 450);
          break;
        case "buildingDestroyed":
          this.explosion(event.x, event.y, event.building);
          break;
      }
    }
  }

  private track(target: Phaser.GameObjects.GameObject) {
    this.effects += 1;
    this.activeEffects.add(target);
    target.once("destroy", () => {
      this.effects -= 1;
      this.activeEffects.delete(target);
    });
  }

  private takeEffect(key: string): Phaser.GameObjects.Image | null {
    if (this.effects >= presentationBudget(this.quality).effects) return null;
    const image = this.effectPool.pop() ?? this.add.image(0, 0, key);
    image
      .setTexture(key)
      .setAlpha(1)
      .setRotation(0)
      .clearTint()
      .setVisible(true)
      .setActive(true);
    this.activeEffects.add(image);
    this.effects += 1;
    return image;
  }

  private releaseEffect(image: Phaser.GameObjects.Image) {
    if (!this.activeEffects.delete(image)) return;
    image.setVisible(false).setActive(false);
    this.effectPool.push(image);
    this.effects -= 1;
  }

  private clearEffects() {
    for (const tween of this.effectMotionTweens) tween.stop();
    this.effectMotionTweens.clear();
    for (const effect of [...this.activeEffects]) {
      this.tweens.killTweensOf(effect);
      if (effect instanceof Phaser.GameObjects.Image)
        this.releaseEffect(effect);
      else effect.destroy();
    }
  }

  private arrow(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    arcFactor = 0.65,
  ) {
    const image = this.takeEffect("arrow");
    if (!image) return;
    image
      .setPosition(fromX, fromY)
      .setScale(1 / this.effectResolution)
      .setDepth(DEPTH.bars + 1)
      .setRotation(Math.atan2(toY - fromY, toX - fromX));
    const motion = { t: 0 };
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.hypot(dx, dy);
    const arc = this.reducedMotion
      ? 0
      : Math.min(70, Math.max(20, distance * arcFactor));
    const tween = this.tweens.add({
      targets: motion,
      t: 1,
      duration: Math.min(520, 180 + distance * 1.15),
      ease: "Sine.easeInOut",
      onUpdate: () => {
        const t = motion.t;
        const x = fromX + dx * t;
        const y = fromY + dy * t - Math.sin(Math.PI * t) * arc;
        const tangentX = dx;
        const tangentY = dy - Math.cos(Math.PI * t) * Math.PI * arc;
        image.setPosition(x, y).setRotation(Math.atan2(tangentY, tangentX));
      },
      onComplete: () => {
        this.effectMotionTweens.delete(tween);
        this.spark(toX, toY - 2, 0.45);
        this.releaseEffect(image);
      },
    });
    this.effectMotionTweens.add(tween);
  }

  private cannonball(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    radius: number,
  ) {
    if (this.effects >= presentationBudget(this.quality).effects) return;
    const ball = this.add
      .circle(fromX, fromY, 4, 0x1f2937, 1)
      .setDepth(DEPTH.bars + 1);
    this.track(ball);
    this.spark(fromX, fromY - 12, 0.65);
    const motion = { t: 0 };
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.hypot(dx, dy);
    const arc = this.reducedMotion
      ? 0
      : Math.min(100, Math.max(30, distance * 0.22));
    const tween = this.tweens.add({
      targets: motion,
      t: 1,
      duration: Math.min(700, 260 + distance * 0.9),
      ease: "Sine.easeInOut",
      onUpdate: () => {
        const t = motion.t;
        const x = fromX + dx * t;
        const y = fromY + dy * t - Math.sin(Math.PI * t) * arc;
        ball.setPosition(x, y);
      },
      onComplete: () => {
        this.effectMotionTweens.delete(tween);
        ball.destroy();
        this.cannonExplosion(toX, toY, radius);
      },
    });
    this.effectMotionTweens.add(tween);
  }

  private cannonExplosion(x: number, y: number, radius: number) {
    const splash = Math.max(24, radius);
    this.ring(x, y, 0xff9f1c, 0.15, Math.max(1.8, splash / 18), 420);
    this.ring(x, y, 0xffffff, 0.1, Math.max(1.2, splash / 24), 260);
    for (
      let i = 0;
      i <
      (this.quality === "low" || this.reducedMotion
        ? 1
        : this.quality === "medium"
          ? 3
          : 5);
      i++
    ) {
      this.spark(
        x +
          Phaser.Math.Between(
            -Math.round(splash * 0.5),
            Math.round(splash * 0.5),
          ),
        y +
          Phaser.Math.Between(
            -Math.round(splash * 0.5),
            Math.round(splash * 0.5),
          ),
        0.8,
      );
    }
  }

  private spark(x: number, y: number, scale: number) {
    const image = this.takeEffect("spark");
    if (!image) return;
    image
      .setPosition(x, y)
      .setScale((scale * 0.6) / this.effectResolution)
      .setDepth(DEPTH.effects);
    this.tweens.add({
      targets: image,
      ...(this.reducedMotion ? {} : { scale: (scale * 1.3) / this.effectResolution }),
      alpha: 0,
      duration: 170,
      onComplete: () => this.releaseEffect(image),
    });
  }

  private ring(
    x: number,
    y: number,
    color: number,
    from: number,
    to: number,
    duration: number,
  ) {
    const image = this.takeEffect("ring");
    if (!image) return;
    image
      .setPosition(x, y)
      .setTint(color)
      .setScale((this.reducedMotion ? to : from) / this.effectResolution)
      .setDepth(DEPTH.effects);
    this.tweens.add({
      targets: image,
      ...(this.reducedMotion ? {} : { scale: to / this.effectResolution }),
      alpha: 0,
      duration,
      onComplete: () => this.releaseEffect(image),
    });
  }

  private explosion(x: number, y: number, type: BuildingType) {
    const big = type === "castle";
    const wood = type === "fence";
    this.ring(
      x,
      y,
      wood ? 0x8b5a2b : 0xff9f1c,
      0.3,
      big ? 3.2 : 1.8,
      big ? 700 : 500,
    );
    this.ring(x, y, 0xffffff, 0.2, big ? 2.2 : 1.2, 400);
    for (
      let i = 0;
      i < (this.reducedMotion || this.quality === "low" ? 1 : big ? 7 : 3);
      i++
    ) {
      this.spark(
        x + Phaser.Math.Between(wood ? -12 : -30, wood ? 12 : 30),
        y + Phaser.Math.Between(wood ? -60 : -20, wood ? 60 : 20),
        big ? 1.4 : 0.9,
      );
    }
    if (this.effects >= presentationBudget(this.quality).effects) return;
    const rubble = this.add.graphics().setDepth(DEPTH.ground);
    this.track(rubble);
    rubble.fillStyle(0x3f3a2a, 0.35);
    rubble.fillEllipse(
      x,
      y + 6,
      big ? 120 : wood ? 30 : 64,
      big ? 54 : wood ? 130 : 22,
    );
    this.tweens.add({
      targets: rubble,
      alpha: 0,
      delay: 12_000,
      duration: 4000,
      onComplete: () => rubble.destroy(),
    });
    if (big && !this.reducedMotion && this.quality !== "low")
      this.cameras.main.shake(180, 0.002);
  }
}
