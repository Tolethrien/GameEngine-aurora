type EntityBody = {
  body: { x: number; y: number; w: number; h: number };
  entityId: string;
};
type Boundry = { x: number; y: number; w: number; h: number };
export interface QuadProps {
  boundry: Boundry;
  capacity: number;
}
export interface CapacityQuadTreeType extends CapacityQuadTree {}
export default class CapacityQuadTree {
  boundry: Boundry;
  capacity: number;
  entities: EntityBody[];
  private quadChildren: Map<string, CapacityQuadTreeType>;
  constructor({ boundry, capacity }: QuadProps) {
    this.boundry = boundry;
    this.capacity = capacity;
    this.entities = [];
    this.quadChildren = new Map();
  }
  insert(entity: EntityBody) {
    if (!this.inBoundries(entity.body, this.boundry)) return true;
    if (this.entities.length < this.capacity) {
      this.entities.push(entity);
      return false;
    } else {
      if (this.quadChildren.size === 0) this.subdevide();
      Array.from(this.quadChildren.values()).every((child) =>
        child.insert(entity)
      );
    }
    return;
  }
  clearQuad() {
    this.quadChildren.clear();
    this.entities = [];
  }
  subdevide() {
    [
      [
        "NW",
        this.boundry.x - this.boundry.w / 2,
        this.boundry.y - this.boundry.h / 2,
      ],
      [
        "NE",
        this.boundry.x + this.boundry.w / 2,
        this.boundry.y - this.boundry.h / 2,
      ],
      [
        "SE",
        this.boundry.x + this.boundry.w / 2,
        this.boundry.y + this.boundry.h / 2,
      ],
      [
        "SW",
        this.boundry.x - this.boundry.w / 2,
        this.boundry.y + this.boundry.h / 2,
      ],
    ].forEach((quadData) =>
      this.quadChildren.set(
        quadData[0] as string,
        new CapacityQuadTree({
          boundry: {
            x: quadData[1] as number,
            y: quadData[2] as number,
            w: this.boundry.w / 2,
            h: this.boundry.h / 2,
          },
          capacity: this.capacity,
        })
      )
    );
  }

  inBoundries(entity: Boundry, region: Boundry) {
    return (
      entity.x + entity.w > region.x - region.w &&
      entity.x - entity.w < region.x + region.w &&
      entity.y + entity.h > region.y - region.h &&
      entity.y - entity.h < region.y + region.h &&
      true
    );
  }
  query(range: Boundry, self: string, arr?: EntityBody["entityId"][]) {
    if (!arr) arr = [];
    if (!this.inBoundries(range, this.boundry)) return arr;
    else {
      this.entities.forEach(
        (entity) =>
          this.inBoundries(entity.body, range) &&
          entity.entityId !== self &&
          arr!.push(entity.entityId)
      );
      this.quadChildren.size !== 0 &&
        this.quadChildren.forEach((child) => child.query(range, self, arr));
    }
    return arr;
  }
}
