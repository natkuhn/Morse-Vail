import "./styles.css";

// based on AtoMV_2022APR11.py by N2LO~> RMEvans
// lots of help from https://stackoverflow.com/a/41094088/1527750
// pause/resume logic from demos described
// here: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume
// end-detection logic is from https://web.dev/audio-scheduling/

// to get the built version to work in a subdirectory, I had to follow
// https://github.com/parcel-bundler/parcel/issues/206
// and to deal with a "plugin is not a function" error, I had to add 
// --no-minify, following 
//https://stackoverflow.com/questions/67069266/parcel-build-error-plugin-is-not-a-function

//TODO:
// make UI pretty
// queue sounds on the fly so that controls work during playback
// draw boundaries around the tape
// draw trails using alpha
// make tape scrollable

let frequency, volume, tdit;

const mvs =
  "~ ETINAMSDRGUKWOHBLZFCP_VX_Q[YJ]56@7___8_/>__^_94=___<__3___2_10" +
  "_-__________?)_____,_________________;__|_.________________:____";

let context = null,
  out = null;
let startTime;
let stopTime; //non-null only when sending
// let checker;
let paused = false;

const canvas = document.getElementById("ticker");
const ctx = canvas.getContext("2d");

const diam = 10; //diameter of dit, in pixels
ctx.lineWidth = diam;
ctx.lineCap = "round";
const xstart = diam / 2;
const ystart = 25;
let codePath;
let tapeLength;


const frequencyElt = document.getElementById("fIn");
frequencyElt.addEventListener("input", frequencyListener);
frequencyListener();

const volumeElt = document.getElementById("vIn");
volumeElt.addEventListener("input", volumeListener);
volumeListener();

const tditElt = document.getElementById("dIn");
tditElt.addEventListener("input", tditListener);
tditListener();

const messageElt = document.getElementById("msg");
messageElt.addEventListener("input", () => {
  // deal with Send button
  if (stopTime) return; //should stay disabled while sending
  enableSend();
});

const sendBtn = document.getElementById("send");
sendBtn.addEventListener("click", () => {
  context = new AudioContext();
  out = context.createGain();
  out.connect(context.destination); // connect vol to context destination
  volumeListener(); //set initial volume

  stopTime = send();
  enable(sendBtn, false);
  enable(frequencyElt, false);
  enable(tditElt, false);
  enable(pauseBtn, true);
  enable(stopBtn, true);
  setPaused(false);

  anim();
  // checker = setInterval(checkTime, 100);
});

const pauseBtn = document.getElementById("pause");
pauseBtn.addEventListener("click", () => {
  // console.log("pause/resume", paused);
  if (paused) {
    setPaused(false);
    context.resume();
  } else {
    setPaused(true);
    context.suspend();
  }
});

const stopBtn = document.getElementById("stop");
stopBtn.addEventListener("click", stopSend);

function send() {
  let dit = 1;
  let dah = dit * 3;
  let space = dit;
  let interCharacter = 3;
  let extraperword = dit * 4;

  let msg = messageElt.value.toUpperCase();
  // console.log(`msg=${msg}`);

  let pos = 0;
  let segments = [new Segment(0,0,false)];
  let segPointer = 0; //always start the loop pointing to a silent segment

  for (var char of msg) {
    if (char == "\n" || char == "\t") char = " "; //white space
    let code = mvs.indexOf(char);
    // console.log(`char=${char}, code=${code}`);
    if (code === 1) segments[segPointer].dits += extraperword; //space
    if (code < 2) continue; //space, or not found
    while (code > 1) {
      adjustPos();
      segments[++segPointer] = new Segment(pos, code & 1 ? dah : dit, true);
      adjustPos();
      segments[++segPointer] = new Segment(pos, space, false);  //could get 
      // elongated later
      code >>= 1; //shift right one bid
    }
    segments[segPointer].dits = interCharacter;
  }
  adjustPos();
  tapeLength = pos * diam;

  let time = context.currentTime;
  startTime = time;
  for (var seg of segments) {
    time = seg.queue(time);
  }

  codePath = new Path2D();
  for (seg of segments) {
    if ( !seg.voiced ) continue;  // silent
    codePath.moveTo( xstart + seg.startPosition * diam , ystart);
    codePath.lineTo( xstart + (seg.startPosition+seg.dits-1) * diam , ystart);
  }

  return time;

  // function posToTime(p) {
  //   return startTime + p * tdit/1000;
  // }

  function adjustPos() {
    pos += segments[segPointer].dits;
  }
}

class Segment {
  constructor(p,d,v) {
    this.startPosition = p;
    this.dits = d;
    this.voiced = v;
    this.played = 0;
    this.tdit= null;
    this.queued = false;
  }

  queue(time) {
    this.startTime = time;
    this.stopTime = time + this.dits * tdit / 1000;
    this.queued = true;
    if ( !this.voiced ) return this.stopTime;
    let osc = context.createOscillator(); // instantiate an oscillator
    osc.frequency.value = frequency;
    osc.connect(out); // connect it to the destination
    osc.start(this.startTime);
    osc.stop(this.stopTime);
    return this.stopTime;
  }
}

function stopSend() {
  // clearInterval(checker); 
  context.close().then(() => {
    stopTime = null;
    setPaused(false);
    enableSend(); //enable if message non-empty
    enable(frequencyElt, true);
    enable(tditElt, true);
    enable(pauseBtn, false);
    enable(stopBtn, false);
  });
}

// function checkTime() {
//   if (context.currentTime >= stopTime) stopSend();
// }

function anim() {
  const now = context.currentTime;
  if (now >= stopTime) {
    stopSend();
    return;
  }
  requestAnimationFrame(anim);
  const proportion = (now-startTime) / (stopTime-startTime);
  // console.log(proportion);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width - proportion * tapeLength, 0);
  ctx.stroke(codePath);
  ctx.restore();
}

function frequencyListener() {
  // console.log("freq", this, e);
  frequency = frequencyElt.value;
  document.getElementById("fOut").innerHTML = frequency + " Hz";
}

function volumeListener() {
  volume = volumeElt.value / 100;
  document.getElementById("vOut").innerHTML = volume;
  if (out) out.gain.value = volume * 0.5;
  // from 0 to 1, 1 full volume, 0 is muted
}

function tditListener() {
  tdit = tditElt.value;
  document.getElementById("dOut").innerHTML = tdit + " ms";
}

function enable(elt, val) {
  if (val) elt.removeAttribute("disabled");
  else elt.setAttribute("disabled", "disabled");
}

function enableSend() {
  enable(sendBtn, !!messageElt.value);
}

function setPaused(val) {
  paused = val;
  pauseBtn.textContent = val ? "Resume" : "Pause";
}
