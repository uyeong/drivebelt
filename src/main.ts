import EventEmitter from 'eventemitter3';

interface BeltOption {
  delay?: number;
  duration?: number;
  loop?: boolean;
  reverse?: boolean;
  round?: boolean;
  easing?: BeltEasingFn;
}

interface BeltListener {
  [eventName: string]: (...args: any[]) => void;
}

type BeltEasingFn = (n: number) => number;

const root = (typeof window === 'undefined' ? global : window) as Window;

function blender(easing: BeltEasingFn, reverse: boolean) {
  return (progress: number, turn: boolean) => {
    // prettier-ignore
    return turn ?
      reverse ? easing(progress) : 1 - easing(progress) :
      reverse ? 1 - easing(progress) : easing(progress);
  };
}

class Belt {
  private emitter: EventEmitter = new EventEmitter();
  private delay: number;
  private duration: number;
  private loop: boolean;
  private reverse: boolean;
  private round: boolean;
  private easing: BeltEasingFn;
  private blend: (n: number, t: boolean) => number;
  private turn: boolean = false;
  private timestamp: number = 0;
  private startTime: number = 0;
  private pastTime: number = 0;
  private rafId: number = 0;

  constructor(option: BeltOption = {}) {
    this.delay = option.delay ?? 0;
    this.duration = option.duration ?? 0;
    this.loop = option.loop ?? false;
    this.reverse = option.reverse ?? false;
    this.round = option.round ?? false;
    this.easing = option.easing ?? ((n: number) => n);
    this.blend = blender(this.easing, this.reverse);
  }

  public option(): BeltOption;
  public option(key: Partial<BeltOption>): void;
  public option<T extends keyof BeltOption>(key: T): BeltOption[T];
  public option<T extends keyof BeltOption>(key: T, value: BeltOption[T]): void;
  public option(key?: keyof BeltOption | Partial<BeltOption>, value?: BeltOption[keyof BeltOption]): any {
    if (key === undefined && value === undefined) {
      return {
        delay: this.delay,
        duration: this.duration,
        loop: this.loop,
        reverse: this.reverse,
        round: this.round,
        easing: this.easing,
      };
    }
    if (typeof key === 'string' && value === undefined) {
      return this[key];
    }
    const currOption = this.option() as { [key: string]: any };
    const nextOption = { ...currOption };
    if (typeof key === 'string' && value !== undefined) {
      nextOption[key] = value;
    }
    if (typeof key === 'object' && key.constructor === Object) {
      for (const name in key /* key is BeltOption */) {
        if (key.hasOwnProperty(name)) {
          nextOption[name] = key[name as keyof BeltOption];
        }
      }
    }
    for (const prop in currOption) {
      if (currOption.hasOwnProperty(prop)) {
        if (currOption[prop] !== nextOption[prop]) {
          // @ts-ignore
          this[prop] = nextOption[prop];
          if (prop === 'duration') {
            this.pastTime = this.duration * (this.pastTime / currOption.duration);
            this.startTime = this.timestamp - this.pastTime;
          }
          if (prop === 'reverse') {
            this.pastTime = this.duration * (1 - this.pastTime / this.duration);
            this.startTime = this.timestamp - this.pastTime;
            this.blend = blender(this.easing, this.reverse);
          }
          if (prop === 'easing') {
            this.blend = blender(this.easing, this.reverse);
          }
        }
      }
    }
  }

  public run() {
    this.pastTime = 0;
    this.startTime = 0;
    const stepping = (timestamp: number) => {
      if (!this.startTime) {
        this.startTime = timestamp - this.pastTime;
      }
      this.timestamp = timestamp;
      this.pastTime = timestamp - this.startTime;
      const progress = this.pastTime / this.duration;
      if (this.pastTime >= this.duration) {
        this.emitter.emit('update', this.blend(1, this.turn));
        if (this.loop || (this.round && !this.turn)) {
          this.startTime = timestamp;
          if (this.round) {
            this.turn = !this.turn;
          }
        } else {
          this.pastTime = 0;
          this.rafId = 0;
          this.turn = false;
          return;
        }
      } else {
        this.emitter.emit('update', this.blend(progress, this.turn));
      }
      this.rafId = root.requestAnimationFrame(stepping);
    };
    root.requestAnimationFrame(stepping);
    return this;
  }

  public on(eventName: string | BeltListener, listener: (...args: any[]) => void, context?: any) {
    if (typeof eventName === 'object' && eventName.constructor === Object) {
      for (const key in eventName /* is BeltListener */) {
        if (eventName.hasOwnProperty(key)) {
          this.emitter.on(key, eventName[key]);
        }
      }
    }
    if (typeof eventName === 'string') {
      this.emitter.on(eventName, listener, context);
    }
    return this;
  }

  public off(eventName: string | BeltListener, listener: (...args: any[]) => void, context?: any) {
    if (typeof eventName === 'object' && eventName.constructor === Object) {
      for (const key in eventName /* is BeltListener */) {
        if (eventName.hasOwnProperty(key)) {
          this.emitter.off(key, eventName[key]);
        }
      }
    }
    if (typeof eventName === 'string') {
      this.emitter.off(eventName, listener, context);
    }
    return this;
  }
}

export default Belt;
export { BeltOption, BeltListener, BeltEasingFn };
