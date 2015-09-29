var camera, scene, renderer, controls, effect, manager;
var distance = 100;

var stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.left = '0px';
stats.domElement.style.top = '0px';
//document.body.appendChild( stats.domElement )

var numActive = 25;

var options = {};
options["Keyboard Input"] = false;
options["Select Song"] = "Danse Macabre"


var song = null;
var songMIDI = null
window.AudioContext = window.AudioContext || window.webkitAudioContext;
var context = new AudioContext();
options["Play"] = function(){
var request = new XMLHttpRequest();
  request.open('GET', "songs/"+options["Select Song"].replace(/ /g,"_")+".mp3", true);
  request.responseType = 'arraybuffer';

  // Decode asynchronously
  request.onload = function() {
    context.decodeAudioData(request.response, function(buffer) {
        MIDI.Player.loadFile("songs/"+options["Select Song"].replace(/ /g,"_")+".mid",function(mid){
            var source = context.createBufferSource();
            source.buffer = buffer;
            var gainNode = context.createGain();
            source.connect(gainNode);
            gainNode.gain.value = 5;
            gainNode.connect(context.destination);
            MIDI.Player.addListener(function(event){
                console.log(event)
                if(event.velocity > 0){
                    noteOn(event.note, event.velocity)
                }else{
                    noteOff(event.note)
                }
            });
            source.start(0);
            MIDI.Player.start();
        },function(){console.log('q')},function(err,as){console.log('asdf',as,err)})

    }, function(){});
  }
  request.send();
    //load midi file
    //load mp3 file
    //Begin playing mp3
    //Begin playing midi
}
var gui = new dat.GUI();
gui.add(options,"Keyboard Input")
//gui.add(options, "Select Song", ["Danse Macabre","Mountain King","Sea at Spring","Toccata And Fugue"]);
//gui.add(options, "Play")
var starGroup
var active = [];
var lastActive = [], lastActiveTime = [];
var boltCache = [];
for(var i = 0; i < numActive; i++){
    active.push(0);
    lastActive.push(0);
    lastActiveTime.push(0);
    boltCache.push({});

}
var time, lightningTexture

var pruneThreshHold = 5; // don't even show stars dimmer than this
var lightningThreshold = 5; // stars dimmer than this don't conduct lightning
var splitThresh = 500; // milliseconds greater will randomly choose new location
var aLength = distance/12; // distance of note a

var fading = [];
var fadeFrac = .95; // how fast the bolts fade
var chordThresh = 100; // milliseconds to consider chord

var segments = 7; //segments of lightning
var lightningWidth = .3;
init();
animate();

function init() {

    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, distance + 10 );
    scene = new THREE.Scene();

    controls = new THREE.VRControls( camera );
    controls.enabled = true;

    starGroup = new THREE.Group();

    var starTexture = THREE.ImageUtils.loadTexture( "assets/star.png" );
    for(var i = 0; i < starList.length; i++){
        if(starList[i].Vmag < pruneThreshHold){
            var dist = distance;
            var theta = starList[i].RAh*15/180*Math.PI;
            var phi = starList[i].DEd/180*Math.PI;
            var x = dist * Math.cos(phi) * Math.cos(theta);
            var y = dist * Math.cos(phi) * Math.sin(theta);
            var z = dist * Math.sin(phi);
            var relStrength = (7.96 - starList[i].Vmag)/9.42;
            var col = new THREE.Color( relStrength+.1, relStrength+.1, relStrength+.1 );
            if(starList[i].Vmag < lightningThreshold){
                //col = new THREE.Color( relStrength, relStrength, .5 );
            }
            var material = new THREE.SpriteMaterial( { transparent:true, map: starTexture, color: col } );
            var sprite = new THREE.Sprite( material );
            sprite.position.set(x, y, z);
            sprite.position.applyAxisAngle (new THREE.Vector3(1,0,0), -Math.PI/4)
            sprite.scale.multiplyScalar(relStrength * 3 *distance/100)
            if(sprite.position.y > -10){
                starGroup.add( sprite );
                if(starList[i].Vmag < lightningThreshold){
                    starGroup.add(sprite)
                }else{
                    scene.add(sprite)
                }
            }
            
        }
    }
    for(var i = 0; i < numActive; i++){
        active[i] = Math.floor(Math.random()*starGroup.children.length);
        lastActive[i] = Math.floor(Math.random()*starGroup.children.length);
    }
    scene.add(starGroup)
    lightningTexture = THREE.ImageUtils.loadTexture('assets/lightning.png');
    lightningTexture.wrapS = lightningTexture.wrapT = THREE.MirroredRepeatWrapping;

    var texture = THREE.ImageUtils.loadTexture('assets/moonTexture.png');
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    var bmap = THREE.ImageUtils.loadTexture('assets/moonBump.png');
    bmap.wrapS = THREE.RepeatWrapping;
    bmap.wrapT = THREE.RepeatWrapping;

    var loader = new THREE.JSONLoader();
    loader.load(
        'assets/moon.json',
        function ( geometry, materials ) {
            var material = new THREE.MeshPhongMaterial( {map: texture,side: THREE.DoubleSide,  bumpMap:bmap, bumpScale: .05 } );
            var surface = new THREE.Mesh( geometry, material );
            surface.position.y = -1;
            surface.scale.multiplyScalar(distance/2)
            scene.add( surface );
            surface.receiveShadow = true
        }
    );
    var flagTexture = THREE.ImageUtils.loadTexture('assets/hackgt.jpg');
    var flagLoader = new THREE.JSONLoader();
    flagLoader.load(
        'assets/flag.json',
        function ( geometry, materials ) {
            var material = new THREE.MeshPhongMaterial( {map: flagTexture,side: THREE.DoubleSide } );
            var flag = new THREE.Mesh( geometry, material );
            flag.position.y = -1.3;
            flag.position.z = -3.3;
            flag.position.x = 2.3;
            flag.rotation.y = Math.PI/2
            flag.scale.multiplyScalar(.3)
            scene.add( flag );
            flag.castShadow = true
        }
    );
    var loader = new THREE.BufferGeometryLoader();
    var wreckTexture = THREE.ImageUtils.loadTexture('assets/wreck.png');
    loader.load(
        'assets/wreck.json',
        function ( geometry ) {
            var material = new THREE.MeshPhongMaterial( { map: wreckTexture, transparent:true } );
            var object = new THREE.Mesh( geometry, material );
            object.scale.multiplyScalar(.5)
            scene.add( object );
            object.position.z = -2
            object.position.y = -.5
            object.position.x = 5
            object.rotation.y = -Math.PI*2/4 + .9
            object.castShadow = true;
        }
    );
    var ambient = new THREE.AmbientLight(0x444444)
    scene.add(ambient)
    light = new THREE.DirectionalLight( 0xffffff, 1.6 );
    light.position.set( 4, 8, 2 );
    scene.add( light );
    light.intensity = .7

    light.castShadow = true;

    light.shadowMapWidth = 1024;
    light.shadowMapHeight = 2048;
    var d = 5;

    light.shadowCameraLeft = -d;
    light.shadowCameraRight = d;
    light.shadowCameraTop = d * 1.5;
    light.shadowCameraBottom = -d;

    light.shadowCameraNear = .1
    light.shadowCameraFar = 50;

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMapEnabled = true;
    effect = new THREE.VREffect(renderer);
    effect.setSize(window.innerWidth, window.innerHeight);
    manager = new WebVRManager(renderer, effect);

    document.body.appendChild( renderer.domElement );

    window.addEventListener( 'resize', onWindowResize, false );

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate(timestamp) {
    time = timestamp
    controls.update();

    for(var i = 0; i < numActive; i++){
        for(var key in boltCache[i]){
            boltCache[i][key].material.uniforms.time.value = timestamp;
        }
    }
    for(var i = 0; i < fading.length; i++){
        fading[i].material.uniforms.time.value = timestamp;
        if(time - fading[i].material.uniforms.startFadingTime.value > 1000){
            scene.remove(fading[i])
            fading.splice(i,1);
            if(i>0){
                i--
            }
        }
    }
    //stats.update()
    manager.render(scene, camera, timestamp);

    requestAnimationFrame( animate );

}

function findStarAtDistance(star, d){
    var closestIndex = 0;
    var closestDistance = Infinity
    for(var i = 0; i < starGroup.children.length; i++){
        var dist = new THREE.Vector3().subVectors(star.position, starGroup.children[i].position).length();
        if(Math.abs(dist - d) < closestDistance){
            closestDistance = Math.abs(dist - d);
            closestIndex = i;
        }
    }
    return closestIndex;
}

function createBolt(startStar, endStar){

    var line = new THREE.Vector3().subVectors(startStar.position, endStar.position)
    var length = line.length()
    line.normalize();
    var viewVec = new THREE.Vector3().addVectors(startStar.position, endStar.position).multiplyScalar(.5).normalize();
    var cross = line.cross(viewVec).multiplyScalar(lightningWidth);

    var geometry = new THREE.Geometry();
    geometry.vertices.push(new THREE.Vector3().copy(startStar.position));
    geometry.vertices.push(new THREE.Vector3().copy(startStar.position));
    geometry.vertices[0].add(cross);
    geometry.vertices[1].sub(cross);
    for(var i = 0; i < segments; i++){
     var start = new THREE.Vector3().lerpVectors(startStar.position, endStar.position, i/segments)
     var end = new THREE.Vector3().lerpVectors(startStar.position, endStar.position, (i + 1)/segments)
     geometry.vertices.push(new THREE.Vector3().copy(end));
     geometry.vertices.push(new THREE.Vector3().copy(end));
     geometry.vertices[2 + i * 2].add(cross);
     geometry.vertices[3 + i * 2].sub(cross);
     geometry.faces.push( new THREE.Face3( 0 + i * 2, 2 + i * 2, 3 + i * 2 ) );
     geometry.faces.push( new THREE.Face3( 0 + i * 2, 3 + i * 2, 1 + i * 2 ) );
     geometry.faceVertexUvs[0].push([new THREE.Vector2(0,1),new THREE.Vector2(1,1),new THREE.Vector2(1,0)])
     geometry.faceVertexUvs[0].push([new THREE.Vector2(0,1),new THREE.Vector2(1,0),new THREE.Vector2(0,0)])
    }
    var material = new THREE.ShaderMaterial({
            transparent:true,
            uniforms: {
                color: {type: 'f', value: 1.0},
                time: {type: 'f', value: time},
                normalPlaneVec: {type: 'v3', value: cross},
                startPoint: {type: 'v3', value: startStar.position},
                length: {type: 'f', value: length},
                startFadingTime: {type: 'f', value: 0},
                //texture:{type:'t', value: lightningTexture}
            },
            vertexShader: document.
                          getElementById('vertShader').text,
            fragmentShader: document.
                          getElementById('fragShader').text
        });
    var line = new THREE.Mesh(geometry, material);
    return line;
}


MIDI.loadPlugin({
    soundfontUrl: ".assets/soundfonts/",
    instrument: "acoustic_grand_piano",
    onprogress: function(state, progress) {
        console.log(state, progress);
    },
    onsuccess: function() {
        MIDI.setVolume(0, 127);
        if (navigator.requestMIDIAccess)
            navigator.requestMIDIAccess().then( onMIDIInit, function(){});
    }
});
var midiAccess=null;
function hookUpMIDIInput() {
    var inputs=midiAccess.inputs.values();
    midiAccess.inputs.forEach( function(entry) {
        entry.onmidimessage = MIDIMessageEventHandler;
    });
}
function onMIDIInit(midi) {
    midiAccess = midi;

    hookUpMIDIInput();
    midiAccess.onstatechange=hookUpMIDIInput;
}
function MIDIMessageEventHandler(event) {
    switch (event.data[0] & 0xf0) {
        case 0x90:
            if (event.data[2]!=0) {
                noteOn(event.data[1], event.data[2]);
                return;
            }
        case 0x80:
            noteOff(event.data[1]);
            return;
    }
}
function noteOn(noteNumber, velocity) {
    var length = aLength / Math.pow(1.059463,noteNumber - 69);
    if(boltCache[0][noteNumber.toString()] == undefined){

        for(var i = 0; i < numActive; i++){
            if(time - lastActiveTime[i] <  chordThresh){
                var next = findStarAtDistance(starGroup.children[lastActive[i]], length)
                var bolt = createBolt(starGroup.children[lastActive[i]], starGroup.children[next]);
                active[i] = next
            }else{
                if(time - lastActiveTime[i] > splitThresh){
                    active[i] = Math.floor(Math.random()* starGroup.children.length)
                }
                lastActiveTime[i] = time;
                var next = findStarAtDistance(starGroup.children[active[i]], length)
                var bolt = createBolt(starGroup.children[active[i]], starGroup.children[next]);
                lastActive[i] = active[i]
                active[i] = next
            }
            scene.add(bolt)

             boltCache[i][noteNumber.toString()] = bolt;
        }
    }
    if(options["Keyboard Input"]){
        console.log('a')
        MIDI.noteOn(0, noteNumber, velocity, 0);
    }
}
function noteOff(noteNumber) {
    if(boltCache[0][noteNumber.toString()] != undefined){
        for(var i = 0; i < numActive; i++){
            fading.push(boltCache[i][noteNumber.toString()])
            boltCache[i][noteNumber.toString()].material.uniforms.startFadingTime.value = time;
            boltCache[i][noteNumber.toString()] = undefined;
            delete boltCache[i][noteNumber.toString()]
        }
    }
    if(options["Keyboard Input"]){
        MIDI.noteOff(0, noteNumber, 0);
    }
}
