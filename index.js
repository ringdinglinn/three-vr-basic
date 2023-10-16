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

scene.background = new THREE.Color(0x29BFFF);

const lightA = new THREE.AmbientLight( 0x404040, 1 ); // soft white light
scene.add( lightA );

// --------- VR ----------
// import { VRButton } from 'three/addons/webxr/VRButton.js';
// document.body.appendChild( VRButton.createButton( renderer ) );
// renderer.xr.enabled = true;


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


// ---------- LOAD MODELS ----------
import { GLTFLoader } from 'GLTFLoader';
const loader = new GLTFLoader();

loader.load('./models/model.glb', function (gltf) {

  gltf.scene.traverse( function( node ) {
    console.log( node.name )

    if ( node.isMesh  ) node.castShadow = true;
    if ( node.isMesh ) node.receiveShadow = true;
  });
 
  scene.add(gltf.scene);
 
  const mixer = new THREE.AnimationMixer( gltf.scene );
  const clips = gltf.animations;

  clips.forEach( function ( clip ) {
    mixer.clipAction( clip ).play();
  });
});


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

// Add the button to the document
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

// renderer.xr.addEventListener( 'sessionstart', function ( event ) {
//   startSound();
// });

// renderer.xr.addEventListener( 'sessionend', function ( event ) {
//   stopSound();
// });

// -------- RENDER --------
function update() {
  mixer.update(clock.getDelta());
}

renderer.setAnimationLoop( anim );

function anim() {
  update();
  controls.update();
  renderer.render(scene, camera);
}