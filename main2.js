var camera, scene, renderer, controls, effect, manager;
var distance = 100;

var starGroup, active = 0;
var lastActive = 0, lastActiveTime = 0;
var time

var pruneThreshHold = 6.5;
var lightningThreshold = 4.5;
var aLength = distance/10;

var boltCache = {};
var fading = [];
var fadeFrac = .95;
var chordThresh = 100;

var segments = 5;

init();
animate();

function init() {

    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, distance + 10 );
    scene = new THREE.Scene();

    controls = new THREE.VRControls( camera );
    controls.enabled = true;

    starGroup = new THREE.Group();

    var starTexture = THREE.ImageUtils.loadTexture( "star.png" );
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
                    if(sprite.position.z < starGroup.children[active].position.z){
                        active = starGroup.children.length - 1;
                    }
                }else{
                    scene.add(sprite)
                }
            }
            
        }
    }
    starGroup.children[active].material.color = new THREE.Color(1,0,0)
    scene.add(starGroup)
    var texture = THREE.ImageUtils.loadTexture('moonTexture.png');
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    var bmap = THREE.ImageUtils.loadTexture('moonBump.png');
    bmap.wrapS = THREE.RepeatWrapping;
    bmap.wrapT = THREE.RepeatWrapping;

    var loader = new THREE.JSONLoader();
    loader.load(
        'surface.json',
        function ( geometry, materials ) {
            var material = new THREE.MeshPhongMaterial( {map: texture,side: THREE.DoubleSide,  bumpMap:bmap, bumpScale: 10 } );
            var surface = new THREE.Mesh( geometry, material );
            surface.position.y = -1;
            surface.scale.multiplyScalar(distance/2)
            scene.add( surface );
        }
    );
    var flagTexture = THREE.ImageUtils.loadTexture('hackgt.jpg');
    var flagLoader = new THREE.JSONLoader();
    flagLoader.load(
        'flag.json',
        function ( geometry, materials ) {
            var material = new THREE.MeshPhongMaterial( {map: flagTexture,side: THREE.DoubleSide } );
            var flag = new THREE.Mesh( geometry, material );
            flag.position.y = -1;
            flag.position.z = -2.5;
            flag.position.x = 2.5;
            flag.rotation.y = Math.PI/2
            flag.scale.multiplyScalar(.2)
            scene.add( flag );
        }
    );

    var ambient = new THREE.AmbientLight(0x888888)
    scene.add(ambient)

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );

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

    for(var key in boltCache){
        boltCache[key].material.uniforms.time.value = timestamp;
    }
    for(var i = 0; i < fading.length; i++){
        if(time - fading[i].material.uniforms.startFadingTime.value > 2000){
            scene.remove(fading[i])
            fading.splice(i,1);
            i--;
        }
    }

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
    var cross = line.cross(viewVec).multiplyScalar(.1);

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
    }
    var material = new THREE.ShaderMaterial({
            uniforms: {
                color: {type: 'f', value: 1.0},
                time: {type: 'f', value: time},
                normalPlaneVec: {type: 'v3', value: cross},
                startPoint: {type: 'v3', value: startStar.position},
                length: {type: 'f', value: length},
                startFadingTime: {type: 'f', value: 0},
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
    soundfontUrl: "./soundfont/",
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

    if(time - lastActiveTime <  chordThresh){
        var next = findStarAtDistance(starGroup.children[lastActive], length)
        var bolt = createBolt(starGroup.children[lastActive], starGroup.children[next]);
        active = next
    }else{
        lastActiveTime = time;
        var next = findStarAtDistance(starGroup.children[active], length)
        var bolt = createBolt(starGroup.children[active], starGroup.children[next]);
        lastActive = active
        active = next
    }


    scene.add(bolt)

    if(boltCache[noteNumber.toString()] !== undefined){
        scene.remove(boltCache[noteNumber.toString()]);
    }
    boltCache[noteNumber.toString()] = bolt;

    MIDI.noteOn(0, noteNumber, velocity, 0);
}
function noteOff(noteNumber) {
    fading.push(boltCache[noteNumber.toString()])
    boltCache[noteNumber.toString()].material.uniforms.startFadingTime.value = time;
    boltCache[noteNumber.toString()] = undefined;
    delete boltCache[noteNumber.toString()]
    MIDI.noteOff(0, noteNumber, 0);
}
