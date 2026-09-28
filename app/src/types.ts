// One visitor, exactly as GET /api/tv/visitors returns it (spec section 6) and as assets/mock/*.json holds it.
export interface Visitor {
  id: string;
  created_at: string;
  first_name: string;
  email?: string;
  product_type: 'pizza' | 'gelato' | 'caffe' | string;
  variant: string;
  favorite: string;
  urls: {
    selfie: string;
    label: string;
    hero: string;
    pdp: string;
    email: string;
    magnet: string;
  };
}

export interface VisitorsResponse {
  now: string;
  visitors: Visitor[];
}

// One step of a scene script (spec section 5). `at` is seconds from the scene start.
export interface Step {
  at: number;
  do: 'type' | 'cursor' | 'click' | 'show' | 'hide' | 'highlight' | 'fly' | 'scroll' | 'swap' | 'wait' | 'set';
  target?: string;
  // type
  text?: string;
  cps?: number;
  // cursor / fly / scroll
  to?: string;
  dur?: number;
  // show / hide
  anim?: string;
  // highlight
  group?: string;
  // fly
  move?: boolean;
  reveal?: string;
  hideSource?: boolean;
  withCursor?: boolean;
  // swap
  src?: string;
  // set
  add?: string;
  remove?: string;
  // camera: false = do not zoom towards this step's target, a number = zoom level
  zoom?: number | false;
  // scroll
  by?: number;
}

export interface Strip {
  label: string;
  names?: string[];
}

export interface SceneScript {
  id: string;
  title: string;
  frame: 'app' | 'card';
  enter?: 'fade' | 'cut' | 'swipe';
  lower?: string;
  strip?: Strip;
  steps: Step[];
}

export interface LoopEntry {
  scene: string;
  dur: number;
}

export interface LoopConfig {
  part1: LoopEntry[];
  part2: LoopEntry[];
  part2Short: string[];
  fetchAt: string;
  batch: number;
  catchUp: { enterAbove: number; exitBelow: number; batch: number };
  cursorLookbackMin: number;
  preloadTimeoutSec: number;
  fetchTimeoutSec: number;
  reloadEveryMin: number;
}

export type Part = 'part1' | 'part2';
