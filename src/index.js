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
// DONE queue sounds on the fly so that controls work during playback
// DONE need to redo pause/resume!
// make UI pretty
// draw boundaries around the tape
// draw trails using alpha
// make tape scrollable

let frequency, volume, tdit;

//queue up next sound when it's within this amount
const trigger = .05  //50 ms

const mvs =
  "~ ETINAMSDRGUKWOHBLZFCP_VX_Q[YJ]56@7___8_/>__^_94=___<__3___2_10" +
  "_-__________?)_____,_________________;__|_.________________:____";

let context = null,
  out = null;
// let startTime;
// let stopTime; //non-null only when sending
// let checker;
let paused = false;
let sending = false;

let segments = [];
let front; //points to the front Segment

const canvas = document.getElementById("ticker");
const ctx = canvas.getContext("2d");

const diam = 10; //diameter of dit, in pixels
ctx.lineWidth = diam;
ctx.lineCap = "round";
const xstart = diam / 2;
const ystart = 25;
let codePath;
// let totalDits;


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
  if ( sending ) return; //should stay disabled while sending
  enableSend(); // will disable, if field is empty.
});

const sendBtn = document.getElementById("send");
sendBtn.addEventListener("click", () => {

  send(messageElt.value.toUpperCase());

  sending = true;
  enable(sendBtn, false);
  enable(pauseBtn, true);
  enable(stopBtn, true);
  setPaused(false);

  createContext();
  front = 0;  // start at the beginning
  anim();

});

const pauseBtn = document.getElementById("pause");
pauseBtn.addEventListener("click", doPause);

const stopBtn = document.getElementById("stop");
stopBtn.addEventListener("click", stopSend);

function send(msg) {
  let dit = 1;
  let dah = dit * 3;
  let space = dit;
  let interCharacter = 3;
  let extraperword = dit * 4;

  // console.log(`msg=${msg}`);

  let pos = 0;
  segments = [new Segment(0,0,false)];
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

  codePath = new Path2D();
  for (var seg of segments) {
    if ( !seg.voiced ) continue;  // silent
    codePath.moveTo( xstart + seg.startPosition * diam , ystart);
    codePath.lineTo( xstart + (seg.startPosition+seg.dits-1) * diam , ystart);
  }

  return;

  function adjustPos() {
    pos += segments[segPointer].dits;
  }
}

class Segment {
  constructor(p,d,v) {
    this.startPosition = p;
    this.dits = d;
    this.voiced = v;
    this.played = 0;  // how many dits played since start (or resume)
    this.playedBeforePause = 0;
    this.tdit= null;
    this.queued = false;
  }

  queue(time) {
    // console.log(`queueing startTime=${time}`)
    this.startTime = time;
    this.tditSec = tdit / 1000;
    this.stopTime = time + (this.dits-this.playedBeforePause) * this.tditSec;
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
  context.close().then(() => {
    sending = false;
    out = null;
    setPaused(false);
    enableSend(); //enable if message non-empty
    enable(pauseBtn, false);
    enable(stopBtn, false);
  });
}

function doPause() {
  // console.log("pause/resume", paused);
  if (paused) {
    createContext();
    setPaused(false);
    anim();
  } else {
    context.close().then(() => {
      out = null;
      setPaused(true);
    });
    const now = context.currentTime;
    let seg = segments[front];
    if ( now < seg.stopTime ) seg.playedBeforePause += seg.played;
    else front++; //should almost never actually happen
    for (var i=front ; i<segments.length ; i++)
      segments[i].queued = false;
  }
}

function createContext() {
  context = new AudioContext();
  out = context.createGain();
  out.connect(context.destination); // connect vol to context destination
  volumeListener(); //set initial volume
}

function anim() {
  if ( paused ) return;
  const now = context.currentTime;
  // console.log(`now=${now}`);
  while ( front < segments.length ) {
    let frontSeg = segments[front];
    if ( !frontSeg.queued ) frontSeg.queue(now);
    if ( frontSeg.stopTime <= now ) {
      front++;
      continue;
    }
    if ( frontSeg.stopTime-now < trigger ) {
      let time = frontSeg.stopTime;
      for ( var i=front+1 ; i<segments.length ; i++ ) {
        if ( segments[i].queued ) {
          time = segments[i].stopTime;
          continue;
        }
        if ( time-now > trigger ) break;
        time = segments[i].queue(time);
      }
    }
    // now we need to position the tape
    frontSeg.played = (now - frontSeg.startTime) / frontSeg.tditSec;
    let tapePosition = diam * 
      (frontSeg.startPosition+frontSeg.playedBeforePause+frontSeg.played);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width - tapePosition, 0);
    ctx.stroke(codePath);
    ctx.restore();
    // console.log('requesting');
    requestAnimationFrame(anim);
    return;
  }
  
  //if we get here, it's the end of the line
  stopSend();
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
