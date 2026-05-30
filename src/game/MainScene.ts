import Phaser from 'phaser';

const WORLD_WIDTH = 8000;
const GROUND_Y = 520;
const BUS_WIDTH = 230;
const BUS_HEIGHT = 60;
const MAN_WIDTH = 18;
const MAN_HEIGHT = 40;
const MAN_SPEED = 180;
const WALK_AREA_TOP = GROUND_Y - 60;
const WALK_AREA_BOTTOM = GROUND_Y + 60;
const DOOR_LOCAL_X = 104;
const DOOR_LOCAL_Y = 8;
const EMBARK_DISTANCE = 32;
const PROMPT_DISTANCE = 110;

const WINDOW_CENTERS = [-62, 0, 62];
const WINDOW_WIDTH = 60;
const WINDOW_HEIGHT = 32;
const WINDOW_Y = -5;

const BUS_CAPACITY = 30;
const STAND_X_FRONT = 87;
const STAND_Y = 0;
const PASSENGER_SPACING = 6;

const MAX_LEVELS = 10;
const LEVEL_FADE_MS = 600;
const LEVEL_HOLD_MS = 1500;

const PREV_DRIVER_SPEED = 70;
const QUOTES: string[] = [
  "First day? You'll do great!",
  "Watch out for kids at stop 7.",
  "Coffee's still hot. Drive safe.",
  "Mrs. Patterson always waves. Wave back.",
  "Halfway through the week!",
  "You're getting the hang of it.",
  "Almost the weekend. Hang in there.",
  "Brakes feel a little soft today.",
  "Big crowd at stop 3 this morning.",
  "Last day already? Make it count!",
];

const STOP_COUNT = 10;
const STOP_FIRST_X = 1400;
const STOP_LAST_X = 7400;
const BOARD_RANGE = 80;
const DEPOT_X = 7850;
const DEPOT_RANGE = 90;
const PASSENGER_MIN = 1;
const PASSENGER_MAX = 5;
const PASSENGER_COLORS = [0xe75555, 0x55a065, 0xa055bb, 0xddaa33, 0xee8844];

type Mode = 'walking' | 'driving';
type Destination = number | 'depot';

interface Passenger {
  sprite: Phaser.GameObjects.Container;
  boarding: boolean;
  destination: Destination;
  color: number;
}

interface OnboardPassenger {
  destination: Destination;
  color: number;
  disembarking: boolean;
  seatedSprite: Phaser.GameObjects.Container;
}

interface BusStop {
  x: number;
  id: number;
  passengers: Passenger[];
}

export class MainScene extends Phaser.Scene {
  private mode: Mode = 'walking';

  private bus!: Phaser.GameObjects.Container;
  private busBody!: Phaser.Physics.Arcade.Body;
  private busPassengerLayer!: Phaser.GameObjects.Container;
  private man!: Phaser.GameObjects.Container;
  private manBody!: Phaser.Physics.Arcade.Body;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private speedText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private passengerText!: Phaser.GameObjects.Text;
  private sky!: Phaser.GameObjects.TileSprite;
  private hills!: Phaser.GameObjects.TileSprite;

  private stops: BusStop[] = [];
  private onboard: OnboardPassenger[] = [];
  private boardingInFlight = 0;
  private delivered = 0;
  private depotArrived = false;
  private level = 1;
  private prevDriver?: Phaser.GameObjects.Container;
  private prevDriverBubble?: Phaser.GameObjects.Text;

  constructor() {
    super('MainScene');
  }

  init(data?: { level?: number }) {
    this.level = data?.level ?? 1;
    this.mode = 'walking';
    this.stops = [];
    this.onboard = [];
    this.boardingInFlight = 0;
    this.delivered = 0;
    this.depotArrived = false;
    this.prevDriver = undefined;
    this.prevDriverBubble = undefined;
  }

  preload() {
    const skyTex = this.textures.createCanvas('sky', 64, 600);
    if (skyTex) {
      const ctx = skyTex.getContext();
      const grad = ctx.createLinearGradient(0, 0, 0, 600);
      grad.addColorStop(0, '#7ec8ff');
      grad.addColorStop(1, '#cfe9ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 600);
      skyTex.refresh();
    }

    const hillTex = this.textures.createCanvas('hills', 400, 200);
    if (hillTex) {
      const ctx = hillTex.getContext();
      ctx.fillStyle = '#5aa15a';
      ctx.beginPath();
      ctx.moveTo(0, 200);
      for (let x = 0; x <= 400; x += 20) {
        const y = 120 + Math.sin(x * 0.03) * 40 + Math.cos(x * 0.07) * 20;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(400, 200);
      ctx.closePath();
      ctx.fill();
      hillTex.refresh();
    }
  }

  create() {
    this.sky = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, 'sky')
      .setOrigin(0, 0)
      .setScrollFactor(0);

    this.hills = this.add
      .tileSprite(0, GROUND_Y - 200, this.scale.width, 200, 'hills')
      .setOrigin(0, 0)
      .setScrollFactor(0);

    this.createCityBackground();
    this.createSuburbBackground();

    const road = this.add.rectangle(
      WORLD_WIDTH / 2,
      GROUND_Y + 40,
      WORLD_WIDTH,
      80,
      0x333333,
    );
    this.physics.add.existing(road, true);

    for (let x = 0; x < WORLD_WIDTH; x += 60) {
      this.add.rectangle(x, GROUND_Y + 40, 30, 4, 0xffe066);
    }

    const busStartX = 560;
    this.bus = this.createBus(busStartX, GROUND_Y);
    this.physics.add.existing(this.bus);
    this.busBody = this.bus.body as Phaser.Physics.Arcade.Body;
    this.busBody.setSize(BUS_WIDTH, BUS_HEIGHT);
    this.busBody.setOffset(-BUS_WIDTH / 2, -BUS_HEIGHT / 2);
    this.busBody.setCollideWorldBounds(true);
    this.busBody.setDragX(300);
    this.busBody.setMaxVelocity(450, 800);

    this.physics.add.collider(this.bus, road);

    this.man = this.createMan(220, GROUND_Y);
    this.physics.add.existing(this.man);
    this.manBody = this.man.body as Phaser.Physics.Arcade.Body;
    this.manBody.setSize(MAN_WIDTH, MAN_HEIGHT);
    this.manBody.setOffset(-MAN_WIDTH / 2, -MAN_HEIGHT / 2);
    this.manBody.setAllowGravity(false);
    this.manBody.setCollideWorldBounds(true);

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, this.scale.height);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, this.scale.height);
    this.cameras.main.startFollow(this.man, true, 0.1, 0.1);

    this.cursors = this.input.keyboard!.createCursorKeys();

    this.speedText = this.add
      .text(16, 16, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0);

    this.hintText = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setVisible(false);

    this.passengerText = this.add
      .text(this.scale.width - 16, 16, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0);

    this.add
      .text(this.scale.width / 2, 16, `Day ${this.level} / ${MAX_LEVELS}`, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);

    const step = (STOP_LAST_X - STOP_FIRST_X) / (STOP_COUNT - 1);
    for (let i = 0; i < STOP_COUNT; i++) {
      this.stops.push(this.createBusStop(STOP_FIRST_X + i * step, i + 1));
    }
    this.createDepot(DEPOT_X);
    this.updatePassengerHud();
    this.spawnPreviousDriver();

    this.cameras.main.fadeIn(LEVEL_FADE_MS, 0, 0, 0);
  }

  private spawnPreviousDriver() {
    const door = this.doorWorldPos();
    this.prevDriver = this.createMan(door.x, GROUND_Y);
    const quote = QUOTES[Math.min(this.level - 1, QUOTES.length - 1)];
    this.prevDriverBubble = this.add
      .text(door.x, GROUND_Y - 38, quote, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#000000',
        backgroundColor: '#ffffff',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5, 1);
  }

  private updatePreviousDriver() {
    if (!this.prevDriver) return;
    const dt = this.game.loop.delta / 1000;
    this.prevDriver.x -= PREV_DRIVER_SPEED * dt;
    this.prevDriverBubble?.setPosition(this.prevDriver.x, this.prevDriver.y - 38);
    const cam = this.cameras.main;
    if (this.prevDriver.x < cam.scrollX - 60) {
      this.prevDriver.destroy();
      this.prevDriverBubble?.destroy();
      this.prevDriver = undefined;
      this.prevDriverBubble = undefined;
    }
  }

  private createDepot(x: number) {
    const roadTop = GROUND_Y + 20;
    const buildingW = 220;
    const buildingH = 160;
    const buildingTop = roadTop - buildingH;
    const buildingCenterY = buildingTop + buildingH / 2;

    const wall = this.add.rectangle(x, buildingCenterY, buildingW, buildingH, 0xc4a577);
    wall.setStrokeStyle(2, 0x222222);

    const roofW = buildingW + 16;
    const roofH = 60;
    this.add.triangle(
      x,
      buildingTop - roofH / 2,
      0,
      roofH,
      roofW,
      roofH,
      roofW / 2,
      0,
      0xa83232,
    );

    const garageH = 110;
    const garage = this.add.rectangle(x, roadTop - garageH / 2, 110, garageH, 0x333344);
    garage.setStrokeStyle(2, 0x111111);
    for (let i = 1; i < 5; i++) {
      this.add.rectangle(x, roadTop - garageH + i * (garageH / 5), 106, 2, 0x111111);
    }

    this.add
      .text(x, buildingTop + 18, 'DEPOT', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
  }

  private createCityBackground() {
    const rng = new Phaser.Math.RandomDataGenerator(['busdriverpro-city']);
    const palette = [0x4a5568, 0x2d3748, 0x718096, 0x3a4555, 0x556270];

    let x = 200;
    while (x < 3700) {
      const w = rng.between(50, 90);
      const h = rng.between(140, 260);
      const color = palette[rng.between(0, palette.length - 1)];

      const building = this.add.rectangle(x + w / 2, GROUND_Y - h / 2, w, h, color);
      building.setStrokeStyle(1, 0x1a1a1a);

      const winSize = 4;
      const cell = 9;
      const cols = Math.floor((w - 10) / cell);
      const rows = Math.floor((h - 16) / cell);
      const innerX = x + (w - cols * cell) / 2;
      const innerY = GROUND_Y - h + 10;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = rng.frac() < 0.6;
          this.add.rectangle(
            innerX + c * cell + winSize / 2,
            innerY + r * cell + winSize / 2,
            winSize,
            winSize,
            lit ? 0xffe066 : 0x1a1a1a,
          );
        }
      }

      x += w + rng.between(4, 14);
    }
  }

  private createSuburbBackground() {
    const rng = new Phaser.Math.RandomDataGenerator(['busdriverpro-suburb']);
    const wallColors = [0xddc4a3, 0xc4b5a0, 0xb0a890, 0xddd5b3, 0xc8a988];
    const roofColors = [0x7d3c3c, 0x5a3a1a, 0x6b4423, 0x4a4a4a];

    let x = 4400;
    while (x < 7700) {
      const w = rng.between(50, 80);
      const wallH = rng.between(38, 50);
      const roofH = rng.between(20, 30);
      const wallColor = wallColors[rng.between(0, wallColors.length - 1)];
      const roofColor = roofColors[rng.between(0, roofColors.length - 1)];

      const wall = this.add.rectangle(x + w / 2, GROUND_Y - wallH / 2, w, wallH, wallColor);
      wall.setStrokeStyle(1, 0x222222);

      const roofW = w + 12;
      this.add.triangle(
        x + w / 2,
        GROUND_Y - wallH - roofH / 2,
        0,
        roofH,
        roofW,
        roofH,
        roofW / 2,
        0,
        roofColor,
      );

      this.add.rectangle(x + w / 2, GROUND_Y - 8, 8, 16, 0x5a3a1a);
      this.add.rectangle(x + 14, GROUND_Y - wallH + 14, 8, 8, 0xc6e6ff);
      this.add.rectangle(x + w - 14, GROUND_Y - wallH + 14, 8, 8, 0xc6e6ff);

      x += w + rng.between(15, 40);
    }
  }

  private createBusStop(x: number, id: number): BusStop {
    const baseY = GROUND_Y + 20;
    this.add.rectangle(x, baseY - 40, 4, 80, 0x666666);
    const sign = this.add.rectangle(x, baseY - 84, 72, 22, 0x2255aa);
    sign.setStrokeStyle(2, 0x111111);
    this.add
      .text(x, baseY - 84, `STOP ${id}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const count = Phaser.Math.Between(PASSENGER_MIN, PASSENGER_MAX);
    const passengers: Passenger[] = [];
    for (let i = 0; i < count; i++) {
      const px = x + 18 + i * 14;
      const color = PASSENGER_COLORS[Phaser.Math.Between(0, PASSENGER_COLORS.length - 1)];
      const destination = this.pickDestination(id);
      const sprite = this.createPassenger(px, GROUND_Y, color);
      passengers.push({ sprite, boarding: false, destination, color });
    }
    return { x, id, passengers };
  }

  private pickDestination(stopId: number): Destination {
    if (stopId >= STOP_COUNT) return 'depot';
    if (Math.random() < 0.5) return 'depot';
    return Phaser.Math.Between(stopId + 1, STOP_COUNT);
  }

  private createPassenger(x: number, y: number, color: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const shirt = color;
    const head = this.add.circle(0, -12, 5, 0xf2c79b);
    head.setStrokeStyle(1, 0x222222);
    const torso = this.add.rectangle(0, 0, 11, 16, shirt);
    torso.setStrokeStyle(1, 0x222222);
    const legL = this.add.rectangle(-3, 11, 4, 10, 0x222244);
    const legR = this.add.rectangle(3, 11, 4, 10, 0x222244);
    c.add([legL, legR, torso, head]);
    return c;
  }

  private updatePassengerHud() {
    this.passengerText.setText(`Delivered: ${this.delivered}`);
  }

  private arriveAtDepot() {
    this.depotArrived = true;
    const remaining = [...this.onboard];
    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      if (p.disembarking) continue;
      p.disembarking = true;
      const targetX = DEPOT_X - 70 + i * 14;
      this.spawnDisembark(p, targetX, GROUND_Y, i * 90, p.destination === 'depot');
    }

    const isFinal = this.level >= MAX_LEVELS;
    this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        isFinal ? 'Game Complete!' : `Day ${this.level} Complete!`,
        {
          fontFamily: 'monospace',
          fontSize: '36px',
          color: '#ffffff',
          backgroundColor: '#000000cc',
          padding: { x: 20, y: 14 },
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0);

    if (isFinal) return;

    this.time.delayedCall(LEVEL_HOLD_MS, () => {
      this.cameras.main.fadeOut(LEVEL_FADE_MS, 0, 0, 0);
      this.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => {
          this.scene.restart({ level: this.level + 1 });
        },
      );
    });
  }

  private boardPassengers(stop: BusStop) {
    let queueIndex = 0;
    for (const p of stop.passengers) {
      if (p.boarding) continue;
      if (this.onboard.length + this.boardingInFlight >= BUS_CAPACITY) break;
      p.boarding = true;
      this.boardingInFlight++;
      const startX = p.sprite.x;
      const startY = p.sprite.y;
      const delay = queueIndex * 90;
      queueIndex++;
      const tracker = { t: 0 };
      this.tweens.add({
        targets: tracker,
        t: 1,
        duration: 350,
        delay,
        ease: 'Quad.Out',
        onUpdate: () => {
          const door = this.doorWorldPos();
          p.sprite.x = Phaser.Math.Linear(startX, door.x, tracker.t);
          p.sprite.y =
            Phaser.Math.Linear(startY, door.y, tracker.t) -
            Math.sin(tracker.t * Math.PI) * 40;
        },
        onComplete: () => {
          p.sprite.destroy();
          this.boardingInFlight--;
          const seatedSprite = this.createSeatedPassenger(p.color);
          this.busPassengerLayer.add(seatedSprite);
          this.onboard.unshift({
            destination: p.destination,
            color: p.color,
            disembarking: false,
            seatedSprite,
          });
          this.layoutSeats();
        },
      });
    }
  }

  private spawnDisembark(
    p: OnboardPassenger,
    targetX: number,
    targetY: number,
    delay: number,
    proper: boolean,
  ) {
    const sprite = this.createPassenger(0, 0, p.color);
    sprite.setVisible(false);
    let startX = 0;
    let startY = 0;
    const tracker = { t: 0 };
    this.tweens.add({
      targets: tracker,
      t: 1,
      duration: 400,
      delay,
      ease: 'Quad.Out',
      onStart: () => {
        const door = this.doorWorldPos();
        startX = door.x;
        startY = door.y;
        sprite.setPosition(startX, startY);
        sprite.setVisible(true);
        p.seatedSprite.destroy();
        const idx = this.onboard.indexOf(p);
        if (idx >= 0) this.onboard.splice(idx, 1);
        this.layoutSeats();
      },
      onUpdate: () => {
        sprite.x = Phaser.Math.Linear(startX, targetX, tracker.t);
        sprite.y =
          Phaser.Math.Linear(startY, targetY, tracker.t) -
          Math.sin(tracker.t * Math.PI) * 40;
      },
      onComplete: () => {
        if (proper) {
          this.delivered++;
          this.updatePassengerHud();
        }
      },
    });
  }

  private disembarkAtStop(stop: BusStop) {
    let queueIndex = 0;
    for (const p of this.onboard) {
      if (p.disembarking) continue;
      if (p.destination !== stop.id) continue;
      p.disembarking = true;
      const targetX = stop.x + 32 + queueIndex * 14;
      this.spawnDisembark(p, targetX, GROUND_Y, queueIndex * 90, true);
      queueIndex++;
    }
  }

  private createBus(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);

    const body = this.add.rectangle(0, 0, BUS_WIDTH, BUS_HEIGHT, 0xffd23f);
    body.setStrokeStyle(2, 0x222222);
    c.add(body);

    for (const wx of WINDOW_CENTERS) {
      const w = this.add.rectangle(wx, WINDOW_Y, WINDOW_WIDTH, WINDOW_HEIGHT, 0xc6e6ff);
      c.add(w);
    }

    this.busPassengerLayer = this.add.container(0, 0);
    c.add(this.busPassengerLayer);

    const winTop = WINDOW_Y - WINDOW_HEIGHT / 2;
    const winBottom = WINDOW_Y + WINDOW_HEIGHT / 2;
    const busTop = -BUS_HEIGHT / 2;
    const busBottom = BUS_HEIGHT / 2;

    const topCover = this.add.rectangle(
      0,
      (busTop + winTop) / 2,
      BUS_WIDTH,
      winTop - busTop,
      0xffd23f,
    );
    c.add(topCover);

    const bottomCover = this.add.rectangle(
      0,
      (winBottom + busBottom) / 2,
      BUS_WIDTH,
      busBottom - winBottom,
      0xffd23f,
    );
    c.add(bottomCover);

    for (let i = 0; i < WINDOW_CENTERS.length - 1; i++) {
      const dx = (WINDOW_CENTERS[i] + WINDOW_CENTERS[i + 1]) / 2;
      const divider = this.add.rectangle(dx, WINDOW_Y, 2, WINDOW_HEIGHT, 0xffd23f);
      c.add(divider);
    }

    const door = this.add.rectangle(DOOR_LOCAL_X, DOOR_LOCAL_Y, 12, 36, 0x222222);
    c.add(door);

    const wheel1 = this.add.circle(-90, BUS_HEIGHT / 2, 10, 0x111111);
    const wheel2 = this.add.circle(90, BUS_HEIGHT / 2, 10, 0x111111);
    c.add(wheel1);
    c.add(wheel2);

    return c;
  }

  private createSeatedPassenger(color: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const head = this.add.circle(0, -12, 4, 0xf2c79b);
    const torso = this.add.rectangle(0, 0, 5, 16, color);
    const legL = this.add.rectangle(-1, 11, 2, 10, 0x222244);
    const legR = this.add.rectangle(1, 11, 2, 10, 0x222244);
    c.add([legL, legR, torso, head]);
    return c;
  }

  private layoutSeats() {
    for (let i = 0; i < this.onboard.length; i++) {
      const p = this.onboard[i];
      const x = STAND_X_FRONT - i * PASSENGER_SPACING;
      p.seatedSprite.setVisible(true);
      p.seatedSprite.setPosition(x, STAND_Y);
    }
  }

  private createMan(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);

    const uniformBrown = 0x6b4423;
    const uniformDark = 0x4a2e15;
    const hiVis = 0xff8800;

    const legL = this.add.rectangle(-4, 14, 5, 12, uniformDark);
    const legR = this.add.rectangle(4, 14, 5, 12, uniformDark);

    const shirt = this.add.rectangle(0, 0, 14, 20, 0xf5e6d3);
    shirt.setStrokeStyle(1, 0x222222);

    const vestL = this.add.rectangle(-4, 0, 6, 20, uniformBrown);
    vestL.setStrokeStyle(1, 0x222222);
    const vestR = this.add.rectangle(4, 0, 6, 20, uniformBrown);
    vestR.setStrokeStyle(1, 0x222222);

    const stripeL = this.add.rectangle(-4, 0, 2, 14, hiVis);
    const stripeR = this.add.rectangle(4, 0, 2, 14, hiVis);

    const head = this.add.circle(0, -14, 7, 0xf2c79b);
    head.setStrokeStyle(1, 0x222222);

    const brim = this.add.rectangle(0, -22, 18, 3, uniformDark);
    brim.setStrokeStyle(1, 0x222222);
    const capTop = this.add.rectangle(0, -27, 14, 6, uniformBrown);
    capTop.setStrokeStyle(1, 0x222222);
    const capBand = this.add.rectangle(0, -24, 14, 2, hiVis);

    c.add([legL, legR, shirt, vestL, vestR, stripeL, stripeR, head, brim, capTop, capBand]);
    return c;
  }

  private doorWorldPos(): { x: number; y: number } {
    return { x: this.bus.x + DOOR_LOCAL_X, y: this.bus.y + DOOR_LOCAL_Y };
  }

  private embark() {
    this.mode = 'driving';
    this.man.setVisible(false);
    this.manBody.enable = false;
    this.cameras.main.startFollow(this.bus, true, 0.1, 0.1, -100, 0);
    this.hintText.setVisible(false);
  }

  private updateWalking() {
    let vx = 0;
    let vy = 0;
    if (this.cursors.left?.isDown) vx -= 1;
    if (this.cursors.right?.isDown) vx += 1;
    if (this.cursors.up?.isDown) vy -= 1;
    if (this.cursors.down?.isDown) vy += 1;

    if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.sqrt(2);
      vx *= inv;
      vy *= inv;
    }

    this.manBody.setVelocity(vx * MAN_SPEED, vy * MAN_SPEED);

    if (this.man.y < WALK_AREA_TOP) {
      this.man.y = WALK_AREA_TOP;
      this.manBody.setVelocityY(0);
    } else if (this.man.y > WALK_AREA_BOTTOM) {
      this.man.y = WALK_AREA_BOTTOM;
      this.manBody.setVelocityY(0);
    }

    const door = this.doorWorldPos();
    const dist = Phaser.Math.Distance.Between(
      this.man.x,
      this.man.y,
      door.x,
      door.y,
    );

    if (dist < EMBARK_DISTANCE) {
      this.embark();
      return;
    }

    if (dist < PROMPT_DISTANCE) {
      this.hintText
        .setText('Walk to the door to board')
        .setPosition(door.x, door.y - 50)
        .setVisible(true);
    } else {
      this.hintText.setVisible(false);
    }

    this.speedText.setText('Walk to the bus');
  }

  private updateDriving() {
    const accel = 400;
    if (this.cursors.right?.isDown) {
      this.busBody.setAccelerationX(accel);
    } else if (this.cursors.left?.isDown) {
      this.busBody.setAccelerationX(-accel);
    } else {
      this.busBody.setAccelerationX(0);
    }

    if (this.cursors.up?.isDown && this.busBody.blocked.down) {
      this.busBody.setVelocityY(-400);
    }

    const mph = Math.round(Math.abs(this.busBody.velocity.x) * 0.15);
    this.speedText.setText(`Speed: ${mph} mph`);

    for (const stop of this.stops) {
      if (Math.abs(this.bus.x - stop.x) < BOARD_RANGE) {
        if (this.busBody.blocked.down) {
          this.boardPassengers(stop);
        }
        this.disembarkAtStop(stop);
      }
    }
    if (!this.depotArrived && Math.abs(this.bus.x - DEPOT_X) < DEPOT_RANGE) {
      this.arriveAtDepot();
    }
  }

  update() {
    if (this.mode === 'walking') {
      this.updateWalking();
    } else {
      this.updateDriving();
    }

    this.updatePreviousDriver();

    const cam = this.cameras.main;
    this.sky.tilePositionX = cam.scrollX * 0.1;
    this.hills.tilePositionX = cam.scrollX * 0.4;
  }
}
