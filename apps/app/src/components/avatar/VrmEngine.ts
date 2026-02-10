import * as THREE from "three";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type VrmEngineState = {
  vrmLoaded: boolean;
  vrmName: string | null;
  idlePlaying: boolean;
  idleTime: number;
  idleTracks: number;
};

type UpdateCallback = () => void;

export type CameraAnimationConfig = {
  enabled: boolean;
  swayAmplitude: number;
  bobAmplitude: number;
  rotationAmplitude: number;
  speed: number;
};

const DEFAULT_CAMERA_ANIMATION: CameraAnimationConfig = {
  enabled: true,
  swayAmplitude: 0.06,
  bobAmplitude: 0.03,
  rotationAmplitude: 0.01,
  speed: 0.8,
};

export class VrmEngine {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private clock = new THREE.Clock();
  private vrm: VRM | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private animationFrameId: number | null = null;
  private onUpdate: UpdateCallback | null = null;
  private initialized = false;
  private loadingAborted = false;

  private mouthValue = 0;
  private mouthSmoothed = 0;
  private vrmName: string | null = null;
  private lookAtTarget = new THREE.Vector3(0, 1, 0);
  private readonly idleGlbUrl = "/animations/idle.glb";
  private forceFaceCameraFlip = true;

  private cameraAnimation: CameraAnimationConfig = { ...DEFAULT_CAMERA_ANIMATION };
  private baseCameraPosition = new THREE.Vector3();
  private elapsedTime = 0;

  setup(canvas: HTMLCanvasElement, onUpdate: UpdateCallback): void {
    if (this.initialized && this.renderer?.domElement === canvas) {
      this.onUpdate = onUpdate;
      return;
    }

    if (this.initialized) {
      this.dispose();
    }

    this.onUpdate = onUpdate;
    this.loadingAborted = false;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(25, 1, 0.01, 1000);
    camera.position.set(0, 1.1, 2.8);
    this.camera = camera;

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(1.5, 2.0, 1.5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
    fillLight.position.set(-1.8, 1.0, 1.0);
    scene.add(fillLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    this.resize(canvas.clientWidth, canvas.clientHeight);
    this.initialized = true;
    this.loop();
  }

  isInitialized(): boolean {
    return this.initialized && this.renderer !== null;
  }

  dispose(): void {
    this.loadingAborted = true;
    this.initialized = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.scene && this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
    }
    this.vrm = null;
    this.vrmName = null;
    this.mixer = null;
    this.idleAction = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.onUpdate = null;
  }

  resize(width: number, height: number): void {
    if (!this.renderer || !this.camera) return;
    if (width <= 0 || height <= 0) return;
    const aspect = width / height;
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  getState(): VrmEngineState {
    const idlePlaying = this.idleAction?.isRunning() ?? false;
    return {
      vrmLoaded: this.vrm !== null,
      vrmName: this.vrmName,
      idlePlaying,
      idleTime: this.idleAction?.time ?? 0,
      idleTracks: this.idleAction?.getClip()?.tracks.length ?? 0,
    };
  }

  setMouthOpen(value: number): void {
    this.mouthValue = Math.max(0, Math.min(1, value));
  }

  setCameraAnimation(config: Partial<CameraAnimationConfig>): void {
    this.cameraAnimation = { ...this.cameraAnimation, ...config };
  }

  setForceFaceCameraFlip(enabled: boolean): void {
    this.forceFaceCameraFlip = enabled;
  }

  async loadVrmFromUrl(url: string, name?: string): Promise<void> {
    if (!this.scene) throw new Error("VrmEngine not initialized");
    if (!this.camera) throw new Error("VrmEngine not initialized");
    if (this.loadingAborted) return;

    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
      this.vrmName = null;
      this.mixer = null;
      this.idleAction = null;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const originalWarn = console.warn;
    type ConsoleArg = string | number | boolean | bigint | symbol | null | undefined | object;
    console.warn = (...args: ConsoleArg[]) => {
      const msg = args.map((a) => String(a)).join(" ");
      if (msg.includes("VRMExpressionLoaderPlugin: An expression preset")) return;
      originalWarn(...args);
    };

    let gltf: Awaited<ReturnType<typeof loader.loadAsync>>;
    try {
      gltf = await loader.loadAsync(url);
    } finally {
      console.warn = originalWarn;
    }

    if (this.loadingAborted || !this.scene) return;

    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) {
      throw new Error("Loaded asset is not a VRM");
    }

    if (vrm.humanoid) {
      vrm.humanoid.autoUpdateHumanBones = true;
    }

    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.combineSkeletons(vrm.scene);

    this.centerAndFrame(vrm);
    if (this.forceFaceCameraFlip) {
      vrm.scene.rotateY(Math.PI);
      vrm.scene.updateMatrixWorld(true);
    } else {
      this.ensureFacingCamera(vrm);
    }

    if (this.loadingAborted || !this.scene) return;

    vrm.scene.visible = false;
    this.scene.add(vrm.scene);
    this.vrm = vrm;
    this.vrmName = name ?? null;

    try {
      await this.loadAndPlayIdle(vrm);
      if (!this.loadingAborted && this.vrm === vrm) {
        vrm.scene.visible = true;
      }
    } catch {
      if (!this.loadingAborted && this.vrm === vrm) {
        vrm.scene.visible = true;
      }
    }
  }

  private loop(): void {
    this.animationFrameId = requestAnimationFrame(() => this.loop());
    const renderer = this.renderer;
    const scene = this.scene;
    const camera = this.camera;
    if (!renderer || !scene || !camera) return;

    const delta = this.clock.getDelta();
    this.elapsedTime += delta;
    this.mixer?.update(delta);
    if (this.vrm) {
      this.applyMouthToVrm(this.vrm, this.mouthValue);
      this.vrm.update(delta);
    }

    if (this.cameraAnimation.enabled && this.baseCameraPosition.length() > 0) {
      const t = this.elapsedTime * this.cameraAnimation.speed;

      const swayX =
        Math.sin(t * 0.5) * 0.6 +
        Math.sin(t * 0.8 + 1.2) * 0.25 +
        Math.sin(t * 1.3 + 2.5) * 0.15;

      const bobY =
        Math.sin(t * 0.7 + 0.5) * 0.5 +
        Math.sin(t * 1.1 + 1.8) * 0.3 +
        Math.sin(t * 0.3) * 0.2;

      const swayZ =
        Math.sin(t * 0.4 + 1.0) * 0.4 +
        Math.sin(t * 0.9 + 2.0) * 0.3;

      camera.position.x =
        this.baseCameraPosition.x + swayX * this.cameraAnimation.swayAmplitude;
      camera.position.y =
        this.baseCameraPosition.y + bobY * this.cameraAnimation.bobAmplitude;
      camera.position.z =
        this.baseCameraPosition.z + swayZ * this.cameraAnimation.swayAmplitude * 0.5;

      const rotX = Math.sin(t * 0.6 + 0.3) * this.cameraAnimation.rotationAmplitude * 0.5;
      const rotY = Math.sin(t * 0.4) * this.cameraAnimation.rotationAmplitude;

      camera.rotation.x = rotX;
      camera.rotation.y = rotY;
    }

    camera.lookAt(this.lookAtTarget);
    renderer.render(scene, camera);
    this.onUpdate?.();
  }

  private centerAndFrame(vrm: VRM): void {
    const camera = this.camera;
    if (!camera) return;

    const box = new THREE.Box3().setFromObject(vrm.scene);
    const center = box.getCenter(new THREE.Vector3());
    vrm.scene.position.sub(center);

    const box2 = new THREE.Box3().setFromObject(vrm.scene);
    const size2 = box2.getSize(new THREE.Vector3());

    const height = Math.max(0.001, size2.y);
    const width = Math.max(0.001, size2.x);
    const depth = Math.max(0.001, size2.z);

    // Normalize all models to a standard reference height (~1.0 unit) so
    // oversized realistic characters and tiny chibi characters appear the
    // same size in the chat viewport.
    const STANDARD_HEIGHT = 1.0;
    const scaleFactor = STANDARD_HEIGHT / height;
    vrm.scene.scale.multiplyScalar(scaleFactor);
    vrm.scene.updateMatrixWorld(true);

    // Re-center after scaling
    const box3 = new THREE.Box3().setFromObject(vrm.scene);
    const center3 = box3.getCenter(new THREE.Vector3());
    vrm.scene.position.sub(center3);

    const scaledHeight = STANDARD_HEIGHT;
    const scaledWidth = width * scaleFactor;
    const scaledDepth = depth * scaleFactor;

    // Frame on upper body: look at shoulder height, zoom in to crop below waist.
    // Offset camera left so the model renders on the right side of the canvas.
    const upperBodyHeight = Math.max(scaledWidth, scaledHeight * 0.55, scaledDepth);
    const shoulderHeight = scaledHeight * 0.42;

    const fovRad = (camera.fov * Math.PI) / 180;
    const fitDistance = (upperBodyHeight * 0.5) / Math.tan(fovRad * 0.5);
    const distance = fitDistance * 1.0;

    // Compute visible width at the model plane, shift to push model right
    const visibleH = 2 * distance * Math.tan(fovRad * 0.5);
    const visibleW = visibleH * (camera.aspect || 1);
    const rightShift = visibleW * 0.10;

    this.lookAtTarget.set(-rightShift, shoulderHeight, 0);

    camera.near = Math.max(0.01, distance / 100);
    camera.far = Math.max(100, distance * 100);
    camera.updateProjectionMatrix();

    camera.position.set(-rightShift, shoulderHeight, distance);
    this.baseCameraPosition.copy(camera.position);
  }

  private async loadAndPlayIdle(vrm: VRM): Promise<void> {
    if (this.loadingAborted) return;

    const { retargetMixamoGltfToVrm } = await import("./retargetMixamoGltfToVrm");

    if (this.loadingAborted || this.vrm !== vrm) return;

    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(this.idleGlbUrl);

    if (this.loadingAborted || this.vrm !== vrm) return;

    gltf.scene.updateMatrixWorld(true);
    vrm.scene.updateMatrixWorld(true);
    const clip = retargetMixamoGltfToVrm(
      { scene: gltf.scene, animations: gltf.animations },
      vrm,
    );

    if (this.loadingAborted || this.vrm !== vrm) return;

    const mixer = new THREE.AnimationMixer(vrm.scene);
    this.mixer = mixer;

    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.fadeIn(0.25);
    action.play();
    this.idleAction = action;
  }

  private applyMouthToVrm(vrm: VRM, mouth: number): void {
    const manager = vrm.expressionManager;
    if (!manager) return;

    const next = Math.max(0, Math.min(1, mouth));
    this.mouthSmoothed = this.mouthSmoothed * 0.75 + next * 0.25;
    manager.setValue("aa", this.mouthSmoothed);
  }

  private ensureFacingCamera(vrm: VRM): void {
    const camera = this.camera;
    if (!camera) return;

    const probe = vrm.humanoid?.getNormalizedBoneNode("hips") ?? vrm.scene;
    vrm.scene.updateMatrixWorld(true);

    const forward = new THREE.Vector3();
    probe.getWorldDirection(forward);

    const vrmPos = new THREE.Vector3();
    vrm.scene.getWorldPosition(vrmPos);

    const toCamera = new THREE.Vector3().subVectors(camera.position, vrmPos);

    forward.y = 0;
    toCamera.y = 0;
    if (forward.lengthSq() < 1e-6 || toCamera.lengthSq() < 1e-6) return;

    forward.normalize();
    toCamera.normalize();

    if (forward.dot(toCamera) < 0) {
      vrm.scene.rotateY(Math.PI);
      vrm.scene.updateMatrixWorld(true);
    }
  }
}
