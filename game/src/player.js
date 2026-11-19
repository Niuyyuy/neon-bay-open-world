// Rio Vale on foot: third-person movement, a camera that orbits on mouse
// drag, and a walk-cycle figure. The camera rig is shared with driving.
import * as THREE from 'three';
import { PLAYER } from './config.js';

export function createPlayerMesh() {
  const group = new THREE.Group();
  group.name = 'RioVale';
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2ecc71 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc9a06a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 0.45), jacket);
  torso.position.y = 1.2;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  cap.position.y = 2.05;
  group.add(cap);
  const legs = [];
  for (const x of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), pants);
    leg.position.set(x, 0.4, 0);
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const x of [-0.55, 0.55]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), jacket);
    arm.position.set(x, 1.2, 0);
    group.add(arm);
    arms.push(arm);
  }
  // A pistol in the right hand, visible when the player shoots.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.45),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.55, 0.95, 0.35);
  group.add(gun);
  group.userData.legs = legs;
  group.userData.arms = arms;
  return group;
}

export function createPlayerController(scene, startX, startZ) {
  const mesh = createPlayerMesh();
  mesh.position.set(startX, 0, startZ);
  scene.add(mesh);
  return {
    mesh,
    x: startX,
    z: startZ,
    heading: 0,
    health: PLAYER.maxHealth,
    walkPhase: 0,
    cameraYaw: Math.PI,
    cameraPitch: 0.35,
    cameraDistance: 8,
    update(dt, move, sprint, yaw, pitch) {
      this.cameraYaw = yaw;
      this.cameraPitch = pitch;
      const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      // Camera-relative movement: forward is away from the camera.
      const fx = -sin;
      const fz = -cos;
      const rx = -cos;
      const rz = sin;
      let mx = fx * -move.z + rx * move.x;
      let mz = fz * -move.z + rz * move.x;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len;
        mz /= len;
        this.x += mx * speed * dt;
        this.z += mz * speed * dt;
        this.heading = Math.atan2(mx, mz);
        this.walkPhase += dt * speed * 1.6;
      }
      const swing = len > 0.01 ? Math.sin(this.walkPhase) * 0.55 : 0;
      mesh.userData.legs[0].rotation.x = swing;
      mesh.userData.legs[1].rotation.x = -swing;
      mesh.userData.arms[0].rotation.x = -swing * 0.7;
      mesh.userData.arms[1].rotation.x = swing * 0.7;
      mesh.position.set(this.x, 0, this.z);
      mesh.rotation.y = this.heading;
    },
    // Third-person camera: behind and above the player, looking at the head.
    placeCamera(camera, targetX, targetZ) {
      const yaw = this.cameraYaw;
      const pitch = this.cameraPitch;
      const d = this.cameraDistance;
      const cx = targetX + Math.sin(yaw) * Math.cos(pitch) * d;
      const cz = targetZ + Math.cos(yaw) * Math.cos(pitch) * d;
      const cy = Math.sin(pitch) * d + 1.2;
      camera.position.set(cx, Math.max(1.2, cy), cz);
      camera.lookAt(targetX, 1.4, targetZ);
    },
  };
}
