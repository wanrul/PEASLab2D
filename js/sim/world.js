import { apartmentCollision } from './apartment-collision-data.js';
const architectureSegments = [...apartmentCollision.walls, ...apartmentCollision.boundaries];

/**
 * CollabPEAS - 2D Apartment World Model
 * Grounded directly in Materials/Apartment.png layout.
 * Accurate room boundaries, obstacles, dirt/wet cells, interactive stations, and NPCs.
 */

export class ApartmentWorld {
  constructor() {
    // Coordinate space matches Apartment.png native dimensions (1326 x 1220)
    this.width = 1326;
    this.height = 1220;

    // Room boundaries aligned with Apartment.png
    this.rooms = [
      {
        id: 'living',
        name: 'Living Room',
        x: 200,
        y: 110,
        width: 480,
        height: 480,
        labelX: 420,
        labelY: 190
      },
      {
        id: 'kitchen',
        name: 'Kitchen',
        x: 170,
        y: 610,
        width: 290,
        height: 380,
        labelX: 300,
        labelY: 660
      },
      {
        id: 'dining',
        name: 'Dining Room',
        x: 470,
        y: 640,
        width: 270,
        height: 350,
        labelX: 580,
        labelY: 680
      },
      {
        id: 'bedroom',
        name: 'Master Bedroom',
        x: 740,
        y: 690,
        width: 290,
        height: 320,
        labelX: 860,
        labelY: 740
      },
      {
        id: 'bathroom',
        name: 'Bathroom',
        x: 780,
        y: 380,
        width: 280,
        height: 290,
        labelX: 880,
        labelY: 410
      },
      {
        id: 'hallway',
        name: 'Hallway / Foyer',
        x: 520,
        y: 430,
        width: 460,
        height: 200,
        labelX: 680,
        labelY: 510
      }
    ];

    // Walls, floor coverage and furniture all use the same model coordinates.
    this.obstacles = apartmentCollision.furniture;

    // Charging Dock Station (Living room north alcove)
    this.dock = {
      x: 580,
      y: 160,
      width: 52,
      height: 42,
      angle: 0
    };

    // Smart Trash Bin (Kitchen entrance)
    this.smartBin = {
      x: 410,
      y: 690,
      width: 36,
      height: 36,
      isOpen: false
    };

    // Belongings Destination Table (Dining table center)
    this.depositTable = {
      x: 580,
      y: 760,
      width: 60,
      height: 60
    };

    // Teleport Markers (Inspired by Fusion VR Training TeleportTargetMarker.cs)
    this.teleportMarkers = [
      { id: 'TP_LIVING', name: 'Living Room', x: 420, y: 380, icon: '🛋️' },
      { id: 'TP_DOCK', name: 'Charging Dock', x: 580, y: 160, icon: '⚡' },
      { id: 'TP_KITCHEN', name: 'Kitchen', x: 330, y: 720, icon: '🍳' },
      { id: 'TP_DINING', name: 'Dining Room', x: 610, y: 840, icon: '🍽️' },
      { id: 'TP_BEDROOM', name: 'Bedroom', x: 880, y: 850, icon: '🛏️' },
      { id: 'TP_BATHROOM', name: 'Bathroom', x: 920, y: 520, icon: '🚿' }
    ];

    // Environmental Walkthrough Tags (Step 2A)
    this.inspectionTags = [
      {
        id: 'TAG_KITCHEN_SPILL',
        x: 320,
        y: 840,
        dimension: 'Partially Observable',
        text: 'Hidden Spill: Your robot cannot see liquid puddles until it arrives directly over them.',
        icon: '👁️‍🗨️'
      },
      {
        id: 'TAG_CAT_PATROL',
        x: 580,
        y: 380,
        dimension: 'Dynamic Environment',
        text: 'Roaming Pet: This obstacle moves! Your robot\'s static map may quickly become invalid.',
        icon: '🐾'
      },
      {
        id: 'TAG_LIVING_ROOM',
        x: 360,
        y: 220,
        dimension: 'Continuous / Non-deterministic',
        text: 'Cluttered Living Space: Multiple continuous trajectories exist through furniture.',
        icon: '🛋️'
      },
      {
        id: 'TAG_HALLWAY_CABLE',
        x: 690,
        y: 530,
        dimension: 'Sensor-Specific Detectability',
        text: 'Thin Hallway Cable: Acoustic distance sonars can miss it; floor SLAM detects it.',
        icon: '🔌'
      },
      {
        id: 'TAG_CHARGING_DOCK',
        x: 580,
        y: 160,
        dimension: 'Goal Localization',
        text: 'Charging Station: Requires reliable coordinate localization for docking return.',
        icon: '⚡'
      }
    ];

    // Interactive Dirt Cells (for Task 1)
    this.dirtCells = this.generateDirtCells();

    // Interactive Wet Spills (for Task 3)
    this.wetCells = this.generateWetCells();

    // Scattered Objects (for Task 2)
    this.objects = [
      { id: 'TRASH_1', type: 'TRASH', name: 'Crumpled Paper', x: 360, y: 440, carried: false, disposed: false, icon: '📄' },
      { id: 'TRASH_2', type: 'TRASH', name: 'Soda Can', x: 500, y: 310, carried: false, disposed: false, icon: '🥫' },
      { id: 'CUP_1', type: 'CUP', name: 'Ceramic Mug', x: 420, y: 240, carried: false, disposed: false, icon: '☕' },
      { id: 'FOOD_1', type: 'FOOD', name: 'Cat Food Bowl', x: 290, y: 780, carried: false, disposed: false, icon: '🥣' }
    ];

    // Fixed living-room entry pose (WASD / arrows remain available).
    this.avatar = {
      x: 130,
      y: 645,
      radius: 18,
      heading: -0.662,
      speed: 3.8,
      moving: false,
      targetX: null,
      targetY: null
    };

    // Roaming Cat NPC (Autonomous dynamic obstacle)
    this.cat = {
      x: 580,
      y: 380,
      radius: 14,
      heading: Math.PI / 4,
      speed: 1.6,
      state: 'walk',
      pauseTimer: 0,
      patrolTargets: [
        { x: 580, y: 380 },
        { x: 360, y: 460 },
        { x: 510, y: 560 },
        { x: 680, y: 460 },
        { x: 440, y: 230 }
      ],
      targetIndex: 0
    };

    // Autonomous Cleaning Robot (Spawned prominently in Living Room ready to clean)
    this.robot = {
      x: 480,
      y: 320,
      radius: 20,
      heading: -Math.PI / 2, // Facing North towards open living room / dirt
      speed: 2.2,
      isSlow: false,
      isStopped: false,
      battery: 100,
      isDocked: false,
      isCharging: false,
      vacuumActive: false,
      mopDeployed: false,
      armExtended: false,
      gripperClosed: false,
      heldObject: null,
      ledColor: 'rgba(59, 130, 246, 0.9)',
      lastTickLog: 'Robot ready in Living Room',
      traceState: { sense: null, decide: null, act: null },
      pathTrail: []
    };
    for (const entity of [this.avatar, this.robot, this.dock, this.smartBin, this.depositTable, ...this.dirtCells, ...this.wetCells, ...this.objects, this.cat, ...this.cat.patrolTargets, ...this.teleportMarkers]) {
      Object.assign(entity, this.nearestWalkable(entity.x, entity.y, 20));
    }
    this.catSpawn = {x:this.cat.x,y:this.cat.y,heading:this.cat.heading,state:this.cat.state,pauseTimer:this.cat.pauseTimer,targetIndex:this.cat.targetIndex};
    this.objectSpawns = this.objects.map(o=>({x:o.x,y:o.y}));
    this.robotSpawn = {x:this.robot.x, y:this.robot.y};
  }

  nearestWalkable(x, y, radius = 20) {
    if (!this.checkCollision(x,y,radius)) return {x,y};
    for (let distance = 2; distance < 1400; distance += 2) {
      const count = Math.max(16, Math.ceil(2*Math.PI*distance/4));
      for (let i=0; i<count; i++) {
        const angle = i/count*2*Math.PI;
        const candidate = {x:x+Math.cos(angle)*distance,y:y+Math.sin(angle)*distance};
        if (!this.checkCollision(candidate.x,candidate.y,radius)) return candidate;
      }
    }
    throw new Error('Apartment has no walkable destination');
  }

  generateDirtCells() {
    const list = [];
    const dirtCoords = [
      { x: 320, y: 310 }, { x: 340, y: 330 }, { x: 360, y: 350 },
      { x: 470, y: 230 }, { x: 490, y: 250 }, { x: 510, y: 270 },
      { x: 350, y: 470 }, { x: 380, y: 490 }, { x: 410, y: 510 },
      { x: 480, y: 470 }, { x: 510, y: 490 }, { x: 530, y: 510 },
      { x: 580, y: 650 }, { x: 610, y: 670 }, { x: 640, y: 690 },
      { x: 860, y: 840 }, { x: 880, y: 860 }
    ];
    dirtCoords.forEach((pt, i) => {
      list.push({
        id: `DIRT_${i}`,
        x: pt.x,
        y: pt.y,
        radius: 12,
        cleaned: false
      });
    });
    return list;
  }

  generateWetCells() {
    return [
      { id: 'WET_1', x: 300, y: 740, radius: 24, cleaned: false, inKitchen: true },
      { id: 'WET_2', x: 330, y: 770, radius: 20, cleaned: false, inKitchen: true },
      { id: 'WET_3', x: 920, y: 520, radius: 22, cleaned: false, inBathroom: true }
    ];
  }

  reset() {
    this.dirtCells.forEach(c => c.cleaned = false);
    this.wetCells.forEach(c => c.cleaned = false);
    this.objects.forEach((o,i) => { Object.assign(o,this.objectSpawns[i]); o.carried = false; o.disposed = false; o.sorted = false; });
    this.smartBin.isOpen = false;
    Object.assign(this.robot,{isDocked:false,isCharging:false,isStopped:false,isSlow:false,ledColor:'rgba(59, 130, 246, 0.9)',traceState:{sense:null,decide:null,act:null}});
    this.robot.x = this.robotSpawn.x;
    this.robot.y = this.robotSpawn.y;
    this.robot.heading = -Math.PI / 2;
    this.robot.battery = 100;
    Object.assign(this.cat,this.catSpawn);
    this.robot.heldObject = null;
    this.robot.vacuumActive = false;
    this.robot.mopDeployed = false;
    this.robot.armExtended = false;
    this.robot.gripperClosed = false;
    this.robot.pathTrail = [];
  }

  checkCollision(x, y, radius = 16) {
    const { floors } = apartmentCollision;
    if (!floors.some(([x0,y0,x1,y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) return true;
    for (const [x0,y0,x1,y1] of architectureSegments) {
      const dx = x1-x0, dy = y1-y0;
      const t = Math.max(0, Math.min(1, ((x-x0)*dx+(y-y0)*dy)/(dx*dx+dy*dy)));
      if (Math.hypot(x-x0-t*dx, y-y0-t*dy) < radius) return true;
    }

    // 2. Obstacles check
    for (const ob of this.obstacles) {
      const nearestX = Math.max(ob.x, Math.min(x, ob.x + ob.w));
      const nearestY = Math.max(ob.y, Math.min(y, ob.y + ob.h));
      if (Math.hypot(x-nearestX,y-nearestY) < radius) return true;
    }
    return false;
  }

  /**
   * Smooth movement resolver with wall-sliding collision response.
   * Prevents getting stuck on corners or invisible barriers.
   */
  resolveMove(startX, startY, dx, dy, radius = 16) {
    // Substeps prevent long frames or fast simulation speeds jumping over walls.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx,dy) / 2));
    let x = startX, y = startY;
    for (let i = 0; i < steps; i++) {
      const nextX = x + dx/steps, nextY = y + dy/steps;
      if (!this.checkCollision(nextX,nextY,radius)) {
        x = nextX; y = nextY;
      } else {
        if (!this.checkCollision(nextX,y,radius)) x = nextX;
        if (!this.checkCollision(x,nextY,radius)) y = nextY;
      }
    }
    return { x, y, moved: Math.hypot(x-startX,y-startY) > 0.001 };
  }
}
