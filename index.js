import * as THREE from 'three';
console.debug(`World using Three.js revision ${THREE.REVISION}`);
import Wizard from '@depasquale/three-wizard';

// --------- SCENE SETUP ---------
const wizard = new Wizard({
  controls: 'ImmersiveControls',
  showFps: true,
});

const { scene, renderer, camera, controls } = wizard;

renderer.shadowMap.enabled = true;
renderer.xr.enabled = true;

scene.background = new THREE.Color(0x0000FF);


// ----------- AUDIO -----------
const listener = new THREE.AudioListener();
camera.add( listener );
const sound = new THREE.Audio( listener );
const audioLoader = new THREE.AudioLoader();
audioLoader.load( './sounds/track.mp3', function( buffer ) {
	sound.setBuffer( buffer );
	sound.setLoop( true );
	sound.setVolume( 0.5 );
});

var clock  = new THREE.Clock();


// ---------- LOAD ANIMATION DATA ----------
let mixer;
const jsonLoader = new THREE.FileLoader();
var triggerAnimsNames = [];
var triggerAnims = {};
var animDict = {};
jsonLoader.load(
  'animation.json',
  // LOADED
  function ( data ) {
    data = data.replace(".", "");
    animDict = JSON.parse(data);
    Object.keys(animDict).map(key => {
      let anims = animDict[key];
      triggerAnimsNames.push(...anims);
    });
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
      console.log(node.name);
      if ( node.isMesh ) node.castShadow = true;
      if ( node.isMesh ) node.receiveShadow = true;
      if (node.name in animDict) makeSelectable(node);
    });
  
    // Animationen aufsetzen
    mixer = new THREE.AnimationMixer( gltf.scene );
    const clips = gltf.animations;
    clips.forEach( clip => {
      console.log(clip);
      if (triggerAnimsNames.includes(clip.name)) {
        mixer.clipAction( clip ).setLoop(THREE.LoopOnce);
        mixer.clipAction( clip ).clampWhenFinished = true;
        triggerAnims[clip.name] = clip;
      } else {
        mixer.clipAction( clip ).play();
      }
    });  
  
    scene.add(gltf.scene);
  
    // -------- RENDER LOOP ---------
    function update() {
      mixer.update(clock.getDelta());
    }
    renderer.setAnimationLoop( anim );
  
    function anim() {
      update();
      controls.update();
      renderer.render(scene, camera);
    }
  });
}

// -------- OBJECT SELECTION -----------
const handleSelectStart = (object, controller) => {
  object.material.emissive.setScalar(0.5);
  console.log(`selected ${object.name}`)
};

const handleSelectEnd = (object, controller) => {
  console.log(animDict);
  object.material.emissive.setScalar(0);
  console.log(animDict[object.name]);
  animDict[object.name].forEach( clipName => {
    mixer.clipAction( triggerAnims[clipName] ).play();
  });
  makeUnselectable(object);
  console.log(`deselected ${object.name}`)
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
  sound.stop();
  buttonText = 'PLAY SOUND'
  button.innerHTML = buttonText;
}

function startSound() {
  if (sound.isPlaying) return;
  sound.play();
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