import * as THREE from 'three';
console.debug(`World using Three.js revision ${THREE.REVISION}`);
import Wizard from '@depasquale/three-wizard';

// --------- SCENE SETUP ---------
const wizard = new Wizard({
  controls: 'ImmersiveControls',
});

const { scene, renderer, camera, controls } = wizard;

controls.radius = 15;                             // <----- Radius des begehbaren Bereichs hier definieren

renderer.shadowMap.enabled = true;
renderer.xr.enabled = true;

scene.background = new THREE.Color(0x0000FF);     // <----- Hintegrundfarbe definieren


const light = new THREE.AmbientLight( 0x404040 ); // <----- Umgebungslicht definieren
scene.add( light );

const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 ); // <----- Sonnenlicht definieren
directionalLight.position.set(10,4,3);
directionalLight.castShadow = true;
scene.add( directionalLight );
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;

// const helper = new THREE.CameraHelper( directionalLight.shadow.camera );
// scene.add( helper );


// ----------- AUDIO -----------
const listener = new THREE.AudioListener();
camera.add( listener );
let sounds = []

// load ambient
const sound = new THREE.Audio( listener );
const audioLoader = new THREE.AudioLoader();
audioLoader.load( './sounds/ambient.mp3', function( buffer ) {
	sound.setBuffer( buffer );
	sound.setLoop( true );
	sound.setVolume( 0.5 );
});
sounds.push(sound);

function makeAudioSource( object ) {
  const sound = new THREE.PositionalAudio( listener );

  var invisibleMat = new THREE.MeshLambertMaterial({color: 0x00ff00, transparent: true, opacity: 0.0});
  object.material = invisibleMat;

  const audioLoader = new THREE.AudioLoader();
  audioLoader.load( "sounds/" + audioDict[object.name], function( buffer ) {
    sound.setBuffer( buffer );
    sound.setLoop( true );
    sound.setRefDistance( 2 );
    sounds.push( sound );
  });

  object.add( sound );
}

// ----------- VIDEO -----------

let videoTextures = [];
function createVideo(object, name) {
  const video = document.createElement('video');
  video.controls = false;
  video.muted = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.style = "display: none;";
  const e = document.getElementById("videoContainer");
  e.appendChild(video);

  const source = document.createElement('source');
  source.src = "./videos/" + name;
  source.type = "video/mp4";
  const gitSource = document.createElement('source');
  gitSource.src = "https://github.com/ringdinglinn/three-vr-basic/blob/master/videos/" + name + "?raw=true";
  gitSource.type = "video/mp4"
  video.appendChild(source);
  video.appendChild(gitSource);

  video.addEventListener('loadeddata', makeVideoMat(video, object), false);
}

function makeVideoMat(video, object) {
  let texture = new THREE.VideoTexture( video );
  texture.colorSpace = THREE.SRGBColorSpace;
  var movieMaterial = new THREE.MeshStandardMaterial({
    emissiveMap: texture,
    map: texture,
    emissive: new THREE.Color(0xFFFFFF),
  });
  object.material = movieMaterial;
  videoTextures.push(texture);
}

// ---------- LOAD CONFIG DATA FROM JSON ----------
var clock  = new THREE.Clock();

let mixer;
const jsonLoader = new THREE.FileLoader();
var triggerAnimsNames = [];
var triggerAnims = {};
var animDict = {};
var moveableObjs = []
var audioDict = {};
var videoDict = {};
jsonLoader.load(
  'einstellungen.json',
  // LOADED
  function ( data ) {
    data = data.replace(".", "");
    data = JSON.parse(data)
    animDict = data["Animation-Trigger"];
    Object.keys(animDict).map(key => {
      let anims = animDict[key];
      triggerAnimsNames.push(...anims);
    });
    moveableObjs = data["Bewegbare Objekte"];
    audioDict = data["Audioquellen"];
    videoDict = data["Videomaterialien"]
    loadModels(); // load models when done with json
	},
  // IN PROGRESS
  function ( xhr ) {
		console.log( 'anim data ' + (xhr.loaded / xhr.total * 100) + '% loaded' );
	},
	// ERROR
	function ( err ) {
		console.error( err );
	}
);

// ---------- LOAD MODELS ----------
import { GLTFLoader } from 'GLTFLoader';
const loader = new GLTFLoader();

function loadModels() {
  loader.load('./models/model.glb', function (gltf) {

    // Objekte aufsetzen
    gltf.scene.traverse( function( node ) {
      if ( node.isMesh ) node.castShadow = true;
      if ( node.isMesh ) node.receiveShadow = true;
      if (node.name in animDict) makeSelectable(node);
      if (moveableObjs.includes(node.name)) makeSelectable(node);
      if (node.name in audioDict) makeAudioSource(node);
      if (node.name in videoDict) createVideo(node, videoDict[node.name]);
    });
  
    // Animationen aufsetzen
    mixer = new THREE.AnimationMixer( gltf.scene );
    const clips = gltf.animations;
    clips.forEach( clip => {
      if (triggerAnimsNames.includes(clip.name)) {
        mixer.clipAction( clip ).setLoop(THREE.LoopOnce);
        mixer.clipAction( clip ).clampWhenFinished = true;
        triggerAnims[clip.name] = clip;
      } else {
        mixer.clipAction( clip ).play();
      }
    });  
  
    scene.add(gltf.scene);

    wizard.start(render);
  });
}

function anim() {
  mixer.update(clock.getDelta());
  renderer.render(scene, camera);
  videoTextures.forEach( tex => tex.needsUpdate = true );
}

// -------- OBJECT SELECTION -----------
const handleSelectStart = (object, controller) => {
  object.material.emissive.setScalar(0.5);
  console.log(`selected ${object.name}`)

  let moveable = moveableObjs.includes(object.name);

  if (moveable) {
    attachToHand(object, controller);
  }
};

const handleSelectEnd = (object, controller) => {
  console.log(animDict);
  object.material.emissive.setScalar(0);

  let moveable = moveableObjs.includes(object.name);
  let anim = object.name in animDict;

  if (anim) {
    playObjectAnimation(object);
    makeUnselectable(object);
  } 
  
  if (moveable) {
    detachFromHand(object, controller);
  }

  console.log(`deselected ${object.name}`)
};

const playObjectAnimation = (object) => {
  animDict[object.name].forEach( clipName => {
    mixer.clipAction( triggerAnims[clipName] ).play();
  });
}

let objectAttachedToMouse;
let distanceToIntersection;
let offset;

const attachToHand = (object, controller) => {
  if (controls.vrControls?.inVr) {
    // VR controller
    if (controller) {
      controller.attach(object);
      controller.userData.selected = object;
    }
  } else {
    // Mouse
    objectAttachedToMouse = object;
  }
}

const detachFromHand = (object, controller) => {
  // objects.attach(object); what is this??
  if (controls.vrControls?.inVr) {
    // VR controller
    if (controller) {
      controller.userData.selected = undefined;
    }
  } else {
    // Mouse
    objectAttachedToMouse = undefined;
    distanceToIntersection = undefined;
    offset = undefined;
  }
}

const render = () => {
  anim();
  if (objectAttachedToMouse) {
    if (!offset) {
      offset = new THREE.Vector3().subVectors(objectAttachedToMouse.position, controls.mouseControls.intersections[0].point);
    }
    if (!distanceToIntersection) {
      distanceToIntersection = new THREE.Vector3().subVectors(controls.cameraData.worldPosition, controls.mouseControls.intersections[0].point).length();
    }
    const vector = new THREE.Vector3();
    vector.set(controls.mouseControls.mousePosition.x, controls.mouseControls.mousePosition.y, 1);
    vector.unproject(camera);
    vector.sub(controls.cameraData.worldPosition).normalize();
    objectAttachedToMouse.position.copy(controls.cameraData.worldPosition).add(vector.multiplyScalar(distanceToIntersection)).add(offset);
  }
};

const makeSelectable = (object) => {
  const type = 'selectableShape';
  object.userData.type = type;
  controls.interaction.selectStartHandlers[type] = handleSelectStart;
  controls.interaction.selectEndHandlers[type] = handleSelectEnd;
  controls.interaction.selectableObjects.push(object);
}

const makeUnselectable = (object) => {
  const index = controls.interaction.selectableObjects.indexOf(2);
  controls.interaction.selectableObjects.splice(index, 1);
}

// ---------- HANDLERS ----------
document.onreadystatechange = () => {
  if (document.readyState !== 'complete') {
    document.querySelector('#loadingIndicator').style.visibility = 'visible';
  } else {
    document.querySelector('#loadingIndicator').style.display = 'none';
  }
};

// ------- AUDIO CONTROLS ----------
var button = document.createElement('button');
var buttonText = 'PLAY SOUND';
button.innerHTML = buttonText;
button.id = 'topRightButton';
button.className = 'top-right-button';

document.body.appendChild(button);

function stopSound() {
  if (!sound.isPlaying) return;
  sounds.forEach(sound => sound.stop() );
  buttonText = 'PLAY SOUND'
  button.innerHTML = buttonText;
}

function startSound() {
  if (sound.isPlaying) return;
  sounds.forEach(sound => sound.play() );
  buttonText = 'MUTE SOUND'
  button.innerHTML = buttonText;
}

document.getElementById('topRightButton').addEventListener('click', function() {
  if (sound.isPlaying) stopSound();
  else startSound();
});

renderer.xr.addEventListener( 'sessionstart', function ( event ) {
  startSound();
});

renderer.xr.addEventListener( 'sessionend', function ( event ) {
  stopSound();
});