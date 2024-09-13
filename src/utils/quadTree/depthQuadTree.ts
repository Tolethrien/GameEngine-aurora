type EntityBody = {
  body: { x: number; y: number; w: number; h: number };
  entityId: string;
};
type Boundry = { x: number; y: number; w: number; h: number };
export interface QuadProps {
  boundry: Boundry;
  depth?: number;
}
type QuadPathSideIndex = 0 | 1 | 2 | 3;
export interface DepthQuadTreeType extends DepthQuadTree {}
export default class DepthQuadTree {
  static maxDepth = 10;
  static indexToDir = { 0: "NW", 1: "NE", 2: "SE", 3: "SW" };
  static quadEntitiesList: Map<string, string[]> = new Map();
  static bodiesInQuad = 0;
  boundry: Boundry;
  entities: Map<string, EntityBody>;
  DepthInTree: number;
  private quadChildren: Map<string, DepthQuadTreeType>;
  constructor({ boundry, depth = 0 }: QuadProps) {
    this.boundry = boundry;
    this.entities = new Map();
    this.quadChildren = new Map();
    this.DepthInTree = depth;
  }
  /**
   * default is 10 but you shoud calculate depth of your tree for your needs.
   */
  setMaxDepth(depth: number) {
    DepthQuadTree.maxDepth = depth;
  }

  insert(entity: EntityBody) {
    this.insertToQuad(entity);
  }
  move(entity: EntityBody) {
    this.remove(entity.entityId);
    this.insertToQuad(entity);
  }
  remove(entityId: string) {
    const entityInQuad = DepthQuadTree.quadEntitiesList.get(entityId);
    let obj: DepthQuadTreeType | undefined;
    if (!entityInQuad) return;
    else {
      if (entityInQuad.length === 0) {
        this.entities.delete(entityId);
        DepthQuadTree.quadEntitiesList.delete(entityId);
        DepthQuadTree.bodiesInQuad--;
      } else
        entityInQuad.forEach((division) => {
          if (!obj) obj = this.quadChildren.get(division);
          else obj = obj.quadChildren.get(division);
        });
    }
    if (obj) {
      obj.entities.delete(entityId);
      DepthQuadTree.quadEntitiesList.delete(entityId);
      DepthQuadTree.bodiesInQuad--;
    }
  }
  query(range: Boundry, self: string) {
    return this.queryQuad(range, self);
  }
  clearQuad() {
    this.quadChildren.clear();
    this.entities.clear();
  }
  private queryQuad(
    range: Boundry,
    self: string,
    arr?: EntityBody["entityId"][]
  ) {
    if (!arr) arr = [];
    if (!DepthQuadTree.inBoundries(range, this.boundry)) return arr;
    else {
      if (DepthQuadTree.isConteined(this.boundry, range)) {
        this.entities.forEach(
          (entity) => entity.entityId !== self && arr!.push(entity.entityId)
        );
      } else {
        this.entities.forEach(
          (entity) =>
            DepthQuadTree.inBoundries(entity.body, range) &&
            entity.entityId !== self &&
            arr!.push(entity.entityId)
        );
      }
      this.quadChildren.size !== 0 &&
        this.quadChildren.forEach((child) => child.queryQuad(range, self, arr));
    }
    return arr;
  }
  private insertToQuad(entity: EntityBody, path?: QuadPathSideIndex[]) {
    if (!path) path = [];
    if (
      this.DepthInTree === 0 &&
      !DepthQuadTree.isConteined(entity.body, this.boundry)
    )
      return false;
    if (this.DepthInTree < DepthQuadTree.maxDepth) {
      this.quadChildren.size === 0 && this.subdevide();
      const arr = Array.from(this.quadChildren.values());
      const { childToFit, notInChildren } = this.dontFitToChildren(
        arr,
        entity,
        path
      );
      if (notInChildren) this.writeToQuad(entity, path);
      else childToFit !== -1 && arr[childToFit].insertToQuad(entity, path);
    }
    return;
  }

  private writeToQuad(entity: EntityBody, path: QuadPathSideIndex[]) {
    DepthQuadTree.quadEntitiesList.set(
      entity.entityId,
      path.map((ind) => DepthQuadTree.indexToDir[ind])
    );
    this.entities.set(entity.entityId, entity);
    DepthQuadTree.bodiesInQuad++;
  }
  private dontFitToChildren(
    arr: DepthQuadTreeType[],
    entity: EntityBody,
    path: number[]
  ) {
    let childToFit = -1;
    return {
      notInChildren: arr.every((child, i) => {
        if (DepthQuadTree.isConteined(entity.body, child.boundry)) {
          childToFit = i;
          path!.push(i);
          return false;
        } else return true;
      }),
      childToFit,
    };
  }
  private subdevide() {
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
        new DepthQuadTree({
          boundry: {
            x: quadData[1] as number,
            y: quadData[2] as number,
            w: this.boundry.w / 2,
            h: this.boundry.h / 2,
          },
          depth: this.DepthInTree + 1,
        })
      )
    );
  }

  private static inBoundries(entity: Boundry, region: Boundry) {
    return (
      entity.x + entity.w > region.x - region.w &&
      entity.x - entity.w < region.x + region.w &&
      entity.y + entity.h > region.y - region.h &&
      entity.y - entity.h < region.y + region.h &&
      true
    );
  }
  private static isConteined(entity: Boundry, region: Boundry) {
    return (
      entity.x - entity.w > region.x - region.w &&
      entity.x + entity.w < region.x + region.w &&
      entity.y - entity.h > region.y - region.h &&
      entity.y + entity.h < region.y + region.h &&
      true
    );
  }
}
