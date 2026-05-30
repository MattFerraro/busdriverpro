import Phaser from 'phaser';

const WORLD_WIDTH = 8000;
const GROUND_Y = 520;
const BUS_WIDTH = 120;
const BUS_HEIGHT = 60;

export class MainScene extends Phaser.Scene {
  private bus!: Phaser.GameObjects.Container;
  private busBody!: Phaser.Physics.Arcade.Body;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private speedText!: Phaser.GameObjects.Text;
  private sky!: Phaser.GameObjects.TileSprite;
  private hills!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('MainScene');
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

    this.bus = this.createBus(200, GROUND_Y);
    this.physics.add.existing(this.bus);
    this.busBody = this.bus.body as Phaser.Physics.Arcade.Body;
    this.busBody.setSize(BUS_WIDTH, BUS_HEIGHT);
    this.busBody.setOffset(-BUS_WIDTH / 2, -BUS_HEIGHT / 2);
    this.busBody.setCollideWorldBounds(true);
    this.busBody.setDragX(300);
    this.busBody.setMaxVelocity(450, 800);

    this.physics.add.collider(this.bus, road);

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, this.scale.height);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, this.scale.height);
    this.cameras.main.startFollow(this.bus, true, 0.1, 0.1, -100, 0);

    this.cursors = this.input.keyboard!.createCursorKeys();

    this.speedText = this.add
      .text(16, 16, 'Speed: 0 mph', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0);
  }

  private createBus(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);

    const body = this.add.rectangle(0, 0, BUS_WIDTH, BUS_HEIGHT, 0xffd23f);
    body.setStrokeStyle(2, 0x222222);

    for (let i = 0; i < 4; i++) {
      const w = this.add.rectangle(-40 + i * 28, -8, 18, 18, 0x88ccee);
      w.setStrokeStyle(1, 0x222222);
      c.add(w);
    }

    const door = this.add.rectangle(45, 8, 12, 36, 0x222222);
    c.add(body);
    c.add(door);

    const wheel1 = this.add.circle(-35, BUS_HEIGHT / 2, 10, 0x111111);
    const wheel2 = this.add.circle(35, BUS_HEIGHT / 2, 10, 0x111111);
    c.add(wheel1);
    c.add(wheel2);

    return c;
  }

  update() {
    if (!this.busBody) return;

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

    const cam = this.cameras.main;
    this.sky.tilePositionX = cam.scrollX * 0.1;
    this.hills.tilePositionX = cam.scrollX * 0.4;

    const mph = Math.round(Math.abs(this.busBody.velocity.x) * 0.15);
    this.speedText.setText(`Speed: ${mph} mph`);
  }
}
